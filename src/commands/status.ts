import { logger, colors } from "../utils/logger.js";
import { loadConfig } from "../lib/config.js";
import { getIssue, getPrStatus, getPrReviewData } from "../lib/github.js";
import { getCurrentBranch, isOnMainBranch, hasUncommittedChanges, getUnpushedCommits, getCommitsSinceBase, getDefaultBranch, getLastCommitTimestamp } from "../lib/git.js";
import { extractIssueNumber, parseBranchName } from "../lib/branch.js";
import { getWorkflowLabels } from "../lib/labels.js";
import { progressExists, readProgress } from "../lib/progress.js";
import { configExists } from "../lib/config.js";
import { checkGhAuth, checkClaudeCli, checkGeminiCli, checkGitRepo } from "../utils/validators.js";
import { getProviderDisplayName } from "../lib/ai-provider.js";
import { getVersion, checkForUpdates } from "../lib/version.js";
import { countActionableFeedback } from "../lib/review-feedback.js";

function formatPrState(state: "open" | "closed" | "merged", isDraft: boolean): string {
  if (state === "merged") {
    return "Merged";
  }
  if (state === "closed") {
    return "Closed";
  }
  return isDraft ? "Open (Draft)" : "Open";
}

function formatReviewDecision(decision: string): string {
  switch (decision) {
    case "APPROVED":
      return "Approved";
    case "CHANGES_REQUESTED":
      return "Changes Requested";
    case "REVIEW_REQUIRED":
      return "Review Required";
    default:
      return decision.replace(/_/g, " ").toLowerCase();
  }
}

export async function statusCommand(): Promise<void> {
  const version = getVersion();
  logger.bold(`Gent Workflow Status ${colors.label(`v${version}`)}`);

  // Check for updates (non-blocking, with short timeout for status command)
  const versionCheck = await checkForUpdates();
  if (versionCheck.updateAvailable && versionCheck.latestVersion) {
    logger.warning(`  Update available: ${version} → ${versionCheck.latestVersion}`);
    logger.dim(`  Run: npm install -g @rotorsoft/gent`);
  }

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
  logger.bold("Configuration:");
  if (configExists()) {
    logger.success("  .gent.yml found");
  } else {
    logger.warning("  .gent.yml not found - using defaults");
  }

  if (progressExists(config)) {
    const progress = readProgress(config);
    const lines = progress.split("\n").length;
    logger.success(`  ${config.progress.file} found (${lines} lines)`);
  } else {
    logger.warning(`  ${config.progress.file} not found`);
  }

  logger.newline();

  // AI Provider status
  logger.bold("AI Provider:");
  const providerName = getProviderDisplayName(config.ai.provider);
  logger.info(`  Active: ${colors.provider(providerName)}`);
  if (config.ai.fallback_provider) {
    const fallbackName = getProviderDisplayName(config.ai.fallback_provider);
    logger.info(`  Fallback: ${fallbackName} (auto: ${config.ai.auto_fallback ? "enabled" : "disabled"})`);
  }
  logger.newline();

  // Prerequisites
  logger.bold("Prerequisites:");
  const ghAuth = await checkGhAuth();
  if (ghAuth) {
    logger.success("  GitHub CLI authenticated");
  } else {
    logger.error("  GitHub CLI not authenticated");
  }

  // Check all AI providers
  const claudeOk = await checkClaudeCli();
  const geminiOk = await checkGeminiCli();

  const getProviderStatus = (provider: "claude" | "gemini"): string => {
    const isActive = config.ai.provider === provider;
    const isFallback = config.ai.fallback_provider === provider;
    const suffix = isActive ? " (active)" : isFallback ? " (fallback)" : "";
    return suffix;
  };

  if (claudeOk) {
    logger.success(`  Claude CLI available${getProviderStatus("claude")}`);
  } else {
    logger.error(`  Claude CLI not found${getProviderStatus("claude")}`);
  }

  if (geminiOk) {
    logger.success(`  Gemini CLI available${getProviderStatus("gemini")}`);
  } else {
    logger.error(`  Gemini CLI not found${getProviderStatus("gemini")}`);
  }

  logger.newline();

  // Git status
  logger.bold("Git Status:");
  const currentBranch = await getCurrentBranch();
  const onMain = await isOnMainBranch();
  const uncommitted = await hasUncommittedChanges();
  const baseBranch = await getDefaultBranch();

  logger.info(`  Branch: ${colors.branch(currentBranch)}`);

  if (onMain) {
    logger.info("  On main branch - ready to start new work");
  } else {
    const branchInfo = parseBranchName(currentBranch);
    if (branchInfo) {
      logger.info(`  Issue: ${colors.issue(`#${branchInfo.issueNumber}`)}`);
      logger.info(`  Type: ${branchInfo.type}`);
    }

    const commits = await getCommitsSinceBase(baseBranch);
    logger.info(`  Commits ahead of ${baseBranch}: ${commits.length}`);

    const unpushed = await getUnpushedCommits();
    if (unpushed) {
      logger.warning("  Has unpushed commits");
    } else {
      logger.success("  Up to date with remote");
    }
  }

  if (uncommitted) {
    logger.warning("  Has uncommitted changes");
  }

  logger.newline();

  // Linked issue status and PR status (only when not on main)
  let prStatus: Awaited<ReturnType<typeof getPrStatus>> = null;
  let hasActionableFeedback = false;

  if (!onMain) {
    const issueNumber = extractIssueNumber(currentBranch);
    if (issueNumber) {
      logger.bold("Linked Issue:");
      try {
        const issue = await getIssue(issueNumber);
        logger.info(`  #${issue.number}: ${issue.title}`);
        logger.info(`  State: ${issue.state}`);
        logger.info(`  Labels: ${issue.labels.join(", ")}`);

        // Check workflow status
        if (issue.labels.includes(workflowLabels.ready)) {
          logger.info(`  Workflow: ${colors.label("ai-ready")}`);
        } else if (issue.labels.includes(workflowLabels.inProgress)) {
          logger.info(`  Workflow: ${colors.label("ai-in-progress")}`);
        } else if (issue.labels.includes(workflowLabels.completed)) {
          logger.info(`  Workflow: ${colors.label("ai-completed")}`);
        } else if (issue.labels.includes(workflowLabels.blocked)) {
          logger.info(`  Workflow: ${colors.label("ai-blocked")}`);
        }
      } catch {
        logger.warning(`  Could not fetch issue #${issueNumber}`);
      }
      logger.newline();
    }

    // PR status
    logger.bold("Pull Request:");
    prStatus = await getPrStatus();
    if (prStatus) {
      const stateDisplay = formatPrState(prStatus.state, prStatus.isDraft);
      logger.info(`  PR #${prStatus.number}: ${stateDisplay}`);
      logger.info(`  ${colors.url(prStatus.url)}`);

      if (prStatus.state === "open") {
        // Fetch review data to show actionable feedback
        try {
          const lastCommitTimestamp = await getLastCommitTimestamp();
          const reviewData = await getPrReviewData(prStatus.number);
          const counts = countActionableFeedback(reviewData, { afterTimestamp: lastCommitTimestamp });
          hasActionableFeedback = counts.total > 0;

          if (prStatus.reviewDecision) {
            logger.info(`  Review: ${formatReviewDecision(prStatus.reviewDecision)}`);
          }

          if (counts.total > 0) {
            logger.warning(`  ${counts.total} actionable review comment${counts.total > 1 ? "s" : ""} can be addressed with ${colors.command("gent fix")}`);
            if (counts.unresolvedThreads > 0) {
              logger.dim(`    ${counts.unresolvedThreads} unresolved thread${counts.unresolvedThreads > 1 ? "s" : ""}`);
            }
            if (counts.changesRequested > 0) {
              logger.dim(`    ${counts.changesRequested} changes requested review${counts.changesRequested > 1 ? "s" : ""}`);
            }
          } else if (prStatus.reviewDecision === "APPROVED") {
            logger.success("  Ready to merge!");
          } else {
            logger.info("  No actionable review comments");
          }
        } catch {
          // Silently ignore review data fetch errors
        }
      } else if (prStatus.state === "merged") {
        logger.success("  This PR has been merged!");
        logger.dim(`  Run ${colors.command("git checkout main && git pull")} to sync`);
      } else if (prStatus.state === "closed") {
        logger.warning("  This PR was closed without merging");
        logger.dim(`  Consider reopening or creating a new PR if changes are still needed`);
      }
    } else {
      logger.info("  No PR created yet");
      logger.dim(`  Run ${colors.command("gent pr")} to create one`);
    }
    logger.newline();
  }

  // Suggestions
  logger.bold("Suggested Actions:");
  if (onMain) {
    logger.list([
      `${colors.command("gent list")} - View ai-ready issues`,
      `${colors.command("gent run --auto")} - Start working on highest priority issue`,
      `${colors.command("gent create <description>")} - Create a new ticket`,
    ]);
  } else if (!prStatus) {
    logger.list([
      `${colors.command("gent pr")} - Create a pull request`,
      `${colors.command("git push")} - Push your changes`,
    ]);
  } else if (prStatus.state === "merged") {
    logger.list([
      `${colors.command("git checkout main && git pull")} - Sync with merged changes`,
    ]);
  } else if (prStatus.state === "closed") {
    logger.list([
      `Reopen the PR if changes are still needed`,
      `${colors.command("git checkout main")} - Return to main branch`,
    ]);
  } else if (hasActionableFeedback) {
    logger.list([
      `${colors.command("gent fix")} - Address review comments with AI`,
      `${colors.command("git push")} - Push any local changes`,
    ]);
  } else {
    logger.list([
      `Review and merge your PR`,
      `${colors.command("git checkout main")} - Return to main branch`,
    ]);
  }
}
