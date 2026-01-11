import { logger, colors } from "../utils/logger.js";
import { loadConfig } from "../lib/config.js";
import { getIssue, getPrForBranch } from "../lib/github.js";
import { getCurrentBranch, isOnMainBranch, hasUncommittedChanges, getUnpushedCommits, getCommitsSinceBase, getDefaultBranch } from "../lib/git.js";
import { extractIssueNumber, parseBranchName } from "../lib/branch.js";
import { getWorkflowLabels } from "../lib/labels.js";
import { progressExists, readProgress } from "../lib/progress.js";
import { configExists } from "../lib/config.js";
import { checkGhAuth, checkClaudeCli, checkGeminiCli, checkGitRepo } from "../utils/validators.js";
import { getProviderDisplayName } from "../lib/ai-provider.js";

export async function statusCommand(): Promise<void> {
  logger.bold("Gent Workflow Status");
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

  // Linked issue status
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
    const pr = await getPrForBranch();
    if (pr) {
      logger.success(`  PR #${pr.number} exists`);
      logger.info(`  ${colors.url(pr.url)}`);
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
  } else {
    const pr = await getPrForBranch();
    if (!pr) {
      logger.list([
        `${colors.command("gent pr")} - Create a pull request`,
        `${colors.command("git push")} - Push your changes`,
      ]);
    } else {
      logger.list([
        `Review and merge your PR`,
        `${colors.command("git checkout main")} - Return to main branch`,
      ]);
    }
  }
}
