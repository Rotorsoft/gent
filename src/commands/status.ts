import chalk from "chalk";
import { logger, colors } from "../utils/logger.js";
import { loadConfig } from "../lib/config.js";
import { getIssue, getPrStatus, getPrReviewData } from "../lib/github.js";
import {
  getCurrentBranch,
  isOnMainBranch,
  hasUncommittedChanges,
  getUnpushedCommits,
  getCommitsSinceBase,
  getDefaultBranch,
  getLastCommitTimestamp,
} from "../lib/git.js";
import { extractIssueNumber, parseBranchName } from "../lib/branch.js";
import { getWorkflowLabels } from "../lib/labels.js";
import { progressExists, readProgress } from "../lib/progress.js";
import { configExists } from "../lib/config.js";
import {
  checkGhAuth,
  checkClaudeCli,
  checkGeminiCli,
  checkCodexCLI,
  checkGitRepo,
} from "../utils/validators.js";
import { getProviderDisplayName } from "../lib/ai-provider.js";
import { getVersion } from "../lib/version.js";
import {
  summarizeReviewFeedback,
  type ReviewFeedbackItem,
} from "../lib/review-feedback.js";
import type { AIProvider } from "../types/index.js";

function formatPrState(
  state: "open" | "closed" | "merged",
  isDraft: boolean
): string {
  if (state === "merged") {
    return chalk.magenta("Merged");
  }
  if (state === "closed") {
    return chalk.red("Closed");
  }
  return isDraft ? chalk.yellow("Open (Draft)") : chalk.green("Open");
}

function formatReviewDecision(decision: string): string {
  switch (decision) {
    case "APPROVED":
      return chalk.green("Approved");
    case "CHANGES_REQUESTED":
      return chalk.red("Changes Requested");
    case "REVIEW_REQUIRED":
      return chalk.yellow("Review Required");
    default:
      return decision.replace(/_/g, " ").toLowerCase();
  }
}

function formatFeedbackLocation(item: ReviewFeedbackItem): string {
  if (item.path && item.line) {
    return `${item.path}:${item.line}`;
  }
  if (item.path) {
    return item.path;
  }
  if (item.source === "review") {
    const stateLabel = item.state
      ? item.state.replace(/_/g, " ").toLowerCase()
      : "review";
    return `[${stateLabel}]`;
  }
  return "[comment]";
}

function truncateFeedbackBody(body: string, maxLength: number): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3)}...`;
}

export async function statusCommand(): Promise<void> {
  const version = getVersion();
  logger.bold(`Gent Workflow Status ${colors.label(`v${version}`)}`);
  logger.newline();

  // Check prerequisites
  const gitRepo = await checkGitRepo();
  if (!gitRepo) {
    logger.error("Not a git repository.");
    process.exit(1);
  }

  const config = loadConfig();
  const workflowLabels = getWorkflowLabels(config);

  // Configuration status
  const configStatus = configExists()
    ? chalk.green("Found")
    : chalk.yellow("Not found - using defaults");
  let progressStatus: string;
  if (progressExists(config)) {
    const progress = readProgress(config);
    const lines = progress.split("\n").length;
    progressStatus = chalk.green(`Found (${lines} lines)`);
  } else {
    progressStatus = chalk.yellow("Not found");
  }
  logger.table("Configuration", [
    { key: ".gent.yml", value: configStatus },
    { key: config.progress.file, value: progressStatus },
  ]);

  // AI Provider status
  const providerName = getProviderDisplayName(config.ai.provider);
  const fallbackValue = config.ai.fallback_provider
    ? `${getProviderDisplayName(config.ai.fallback_provider)} (auto: ${config.ai.auto_fallback ? "enabled" : "disabled"})`
    : "";
  logger.table("AI Provider", [
    { key: "Active", value: colors.provider(providerName) },
    { key: "Fallback", value: fallbackValue },
  ]);

  // Prerequisites
  const [ghAuth, claudeOk, geminiOk, codexOk] = await Promise.all([
    checkGhAuth(),
    checkClaudeCli(),
    checkGeminiCli(),
    checkCodexCLI(),
  ]);

  const getProviderStatus = (provider: AIProvider): string => {
    const isActive = config.ai.provider === provider;
    const isFallback = config.ai.fallback_provider === provider;
    return isActive ? " (active)" : isFallback ? " (fallback)" : "";
  };

  const cliStatus = (ok: boolean, provider: AIProvider) => {
    const suffix = getProviderStatus(provider);
    return ok
      ? chalk.green(`Available${suffix}`)
      : chalk.red(`Not found${suffix}`);
  };

  logger.table("Prerequisites", [
    {
      key: "GitHub CLI",
      value: ghAuth ? chalk.green("Authenticated") : chalk.red("Not authenticated"),
    },
    { key: "Claude CLI", value: cliStatus(claudeOk, "claude") },
    { key: "Gemini CLI", value: cliStatus(geminiOk, "gemini") },
    { key: "Codex CLI", value: cliStatus(codexOk, "codex") },
  ]);

  // Git status
  const currentBranch = await getCurrentBranch();
  const onMain = await isOnMainBranch();
  const uncommitted = await hasUncommittedChanges();
  const baseBranch = await getDefaultBranch();

  const gitEntries: { key: string; value: string }[] = [
    { key: "Branch", value: colors.branch(currentBranch) },
  ];

  if (onMain) {
    gitEntries.push({ key: "Status", value: "On main branch - ready to start new work" });
  } else {
    const branchInfo = parseBranchName(currentBranch);
    if (branchInfo) {
      gitEntries.push({ key: "Issue", value: colors.issue(`#${branchInfo.issueNumber}`) });
      gitEntries.push({ key: "Type", value: branchInfo.type });
    }

    const commits = await getCommitsSinceBase(baseBranch);
    gitEntries.push({ key: `Commits ahead of ${baseBranch}`, value: String(commits.length) });

    const unpushed = await getUnpushedCommits();
    gitEntries.push({
      key: "Push status",
      value: unpushed ? chalk.yellow("Has unpushed commits") : chalk.green("Up to date with remote"),
    });
  }

  if (uncommitted) {
    gitEntries.push({ key: "Working tree", value: chalk.yellow("Has uncommitted changes") });
  }

  logger.table("Git Status", gitEntries);

  // Linked issue status and PR status (only when not on main)
  let prStatus: Awaited<ReturnType<typeof getPrStatus>> = null;
  let hasActionableFeedback = false;

  if (!onMain) {
    const issueNumber = extractIssueNumber(currentBranch);
    if (issueNumber) {
      try {
        const issue = await getIssue(issueNumber);

        let workflowValue = "";
        if (issue.labels.includes(workflowLabels.ready)) {
          workflowValue = colors.label("ai-ready");
        } else if (issue.labels.includes(workflowLabels.inProgress)) {
          workflowValue = colors.label("ai-in-progress");
        } else if (issue.labels.includes(workflowLabels.completed)) {
          workflowValue = colors.label("ai-completed");
        } else if (issue.labels.includes(workflowLabels.blocked)) {
          workflowValue = colors.label("ai-blocked");
        }

        logger.table("Linked Issue", [
          { key: "Issue", value: `${colors.issue(`#${issue.number}`)} ${issue.title}` },
          { key: "State", value: issue.state },
          { key: "Labels", value: issue.labels.map((l) => colors.label(l)).join(", ") },
          { key: "Workflow", value: workflowValue },
        ]);
      } catch {
        logger.table("Linked Issue", [
          { key: "Issue", value: chalk.yellow(`Could not fetch #${issueNumber}`) },
        ]);
      }
    }

    // PR status
    prStatus = await getPrStatus();
    if (prStatus) {
      const prEntries: { key: string; value: string }[] = [
        { key: "PR", value: `#${prStatus.number} ${formatPrState(prStatus.state, prStatus.isDraft)}` },
        { key: "URL", value: colors.url(prStatus.url) },
      ];

      if (prStatus.state === "open") {
        try {
          const lastCommitTimestamp = await getLastCommitTimestamp();
          const reviewData = await getPrReviewData(prStatus.number);
          const { items } = summarizeReviewFeedback(reviewData, {
            afterTimestamp: lastCommitTimestamp,
          });
          hasActionableFeedback = items.length > 0;

          if (prStatus.reviewDecision) {
            prEntries.push({ key: "Review", value: formatReviewDecision(prStatus.reviewDecision) });
          }

          if (items.length > 0) {
            prEntries.push({
              key: "Feedback",
              value: chalk.yellow(`${items.length} actionable comment${items.length > 1 ? "s" : ""} — fix with ${colors.command("gent fix")}`),
            });
            for (const item of items) {
              const location = formatFeedbackLocation(item);
              const body = truncateFeedbackBody(item.body, 60);
              prEntries.push({ key: "", value: chalk.dim(`${location}: ${body}`) });
            }
          } else if (prStatus.reviewDecision === "APPROVED") {
            prEntries.push({ key: "Status", value: chalk.green("Ready to merge!") });
          } else {
            prEntries.push({ key: "Feedback", value: "No actionable review comments" });
          }
        } catch {
          // Silently ignore review data fetch errors
        }
      } else if (prStatus.state === "merged") {
        prEntries.push({ key: "Status", value: chalk.green("This PR has been merged!") });
        prEntries.push({ key: "Next", value: chalk.dim(`Run ${colors.command("git checkout main && git pull")} to sync`) });
      } else if (prStatus.state === "closed") {
        prEntries.push({ key: "Status", value: chalk.yellow("Closed without merging") });
        prEntries.push({ key: "Next", value: chalk.dim("Consider reopening or creating a new PR") });
      }

      logger.table("Pull Request", prEntries);
    } else {
      logger.table("Pull Request", [
        { key: "Status", value: "No PR created yet" },
        { key: "Next", value: chalk.dim(`Run ${colors.command("gent pr")} to create one`) },
      ]);
    }
  }

  // Suggestions
  let suggestions: { key: string; value: string }[] = [];
  if (onMain) {
    suggestions = [
      { key: "gent list", value: "View ai-ready issues" },
      { key: "gent run --auto", value: "Start working on highest priority issue" },
      { key: "gent create", value: "Create a new ticket" },
    ];
  } else if (!prStatus) {
    suggestions = [
      { key: "gent pr", value: "Create a pull request" },
      { key: "git push", value: "Push your changes" },
    ];
  } else if (prStatus.state === "merged") {
    suggestions = [
      { key: "git checkout main && git pull", value: "Sync with merged changes" },
    ];
  } else if (prStatus.state === "closed") {
    suggestions = [
      { key: "Reopen PR", value: "If changes are still needed" },
      { key: "git checkout main", value: "Return to main branch" },
    ];
  } else if (hasActionableFeedback) {
    suggestions = [
      { key: "gent fix", value: "Address review comments with AI" },
      { key: "git push", value: "Push any local changes" },
    ];
  } else {
    suggestions = [
      { key: "Merge PR", value: "Review and merge your pull request" },
      { key: "git checkout main", value: "Return to main branch" },
    ];
  }
  logger.table("Suggested Actions", suggestions);
}
