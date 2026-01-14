import inquirer from "inquirer";
import { logger, colors } from "../utils/logger.js";
import { withSpinner } from "../utils/spinner.js";
import { loadConfig, loadAgentInstructions } from "../lib/config.js";
import { getIssue, getPrForBranch, getPrReviewData, replyToReviewComment, addPrComment } from "../lib/github.js";
import { buildImplementationPrompt } from "../lib/prompts.js";
import { invokeAIInteractive, getProviderDisplayName } from "../lib/ai-provider.js";
import { getCurrentBranch, isOnMainBranch, hasUncommittedChanges, getCurrentCommitSha, hasNewCommits, getLastCommitTimestamp } from "../lib/git.js";
import { extractIssueNumber } from "../lib/branch.js";
import { readProgress } from "../lib/progress.js";
import { summarizeReviewFeedback, type ReviewFeedbackItem } from "../lib/review-feedback.js";
import { checkGhAuth, checkAIProvider } from "../utils/validators.js";
import type { AIProvider, GitHubReviewData } from "../types/index.js";

export interface FixOptions {
  provider?: AIProvider;
}

export async function fixCommand(options: FixOptions): Promise<void> {
  logger.bold("Applying PR review feedback with AI...");
  logger.newline();

  const config = loadConfig();
  const provider = options.provider ?? config.ai.provider;
  const providerName = getProviderDisplayName(provider);

  const [ghAuth, aiOk] = await Promise.all([
    checkGhAuth(),
    checkAIProvider(provider),
  ]);

  if (!ghAuth) {
    logger.error("Not authenticated with GitHub. Run 'gh auth login' first.");
    process.exit(1);
  }

  if (!aiOk) {
    logger.error(`${providerName} CLI not found. Please install ${provider} CLI first.`);
    process.exit(1);
  }

  if (await isOnMainBranch()) {
    logger.error("Cannot apply fixes from main/master branch. Switch to the PR branch first.");
    process.exit(1);
  }

  const hasChanges = await hasUncommittedChanges();
  if (hasChanges) {
    logger.warning("You have uncommitted changes.");
    const { proceed } = await inquirer.prompt([
      {
        type: "confirm",
        name: "proceed",
        message: "Continue anyway?",
        default: false,
      },
    ]);
    if (!proceed) {
      logger.info("Aborting. Please commit or stash your changes first.");
      process.exit(0);
    }
  }

  const pr = await withSpinner("Resolving pull request...", async () => {
    return getPrForBranch();
  });

  if (!pr) {
    logger.error("No pull request found for the current branch. Create one with 'gent pr' first.");
    process.exit(1);
  }

  const lastCommitTimestamp = await getLastCommitTimestamp();

  const reviewData = await withSpinner("Fetching review feedback...", async () => {
    return getPrReviewData(pr.number);
  });

  const totalComments = countReviewComments(reviewData);
  if (totalComments === 0) {
    logger.error(`No review comments found for PR #${pr.number}.`);
    process.exit(1);
  }

  // Filter feedback to only show comments after the last commit (plus unresolved threads)
  const { items, summary } = summarizeReviewFeedback(reviewData, { afterTimestamp: lastCommitTimestamp });
  if (items.length === 0 || !summary) {
    logger.error("No new actionable review feedback found since your last commit.");
    process.exit(1);
  }

  logger.newline();
  logger.box("Review Feedback Summary", summary);
  logger.newline();

  const currentBranch = await getCurrentBranch();
  const issueNumber = extractIssueNumber(currentBranch);
  if (!issueNumber) {
    logger.error("Could not determine issue number from branch name.");
    process.exit(1);
  }

  const issue = await withSpinner("Fetching linked issue...", async () => {
    return getIssue(issueNumber);
  });

  const agentInstructions = loadAgentInstructions();
  const progressContent = readProgress(config);
  const prompt = buildImplementationPrompt(issue, agentInstructions, progressContent, config, summary);

  logger.newline();
  logger.info(`Starting ${colors.provider(providerName)} fix session...`);
  logger.dim("Review feedback will be appended to the implementation prompt.");
  logger.newline();

  const beforeSha = await getCurrentCommitSha();

  let wasCancelled = false;
  const handleSignal = () => {
    wasCancelled = true;
  };
  process.on("SIGINT", handleSignal);
  process.on("SIGTERM", handleSignal);

  let aiExitCode: number | undefined;
  try {
    const { result } = await invokeAIInteractive(prompt, config, options.provider);
    aiExitCode = result.exitCode ?? undefined;
  } catch (error) {
    if (error && typeof error === "object" && "exitCode" in error) {
      aiExitCode = error.exitCode as number;
    }
    logger.error(`${providerName} session failed: ${error}`);
  } finally {
    process.off("SIGINT", handleSignal);
    process.off("SIGTERM", handleSignal);
  }

  logger.newline();

  if (wasCancelled) {
    logger.warning("Operation was cancelled. No changes were recorded.");
    return;
  }

  const commitsCreated = await hasNewCommits(beforeSha);
  if (commitsCreated) {
    logger.success(`${providerName} session completed with new commits.`);

    // Reply to feedback items to indicate they were addressed
    await replyToFeedbackItems(pr.number, items);

    return;
  }

  const isRateLimited = aiExitCode === 2;
  if (isRateLimited) {
    logger.warning(`${providerName} session ended due to rate limits. No commits were created.`);
    return;
  }

  logger.warning(`${providerName} session completed but no commits were created.`);
}

function countReviewComments(data: GitHubReviewData): number {
  const reviewBodies = data.reviews.filter((review) => review.body?.trim()).length;
  const threadBodies = data.reviewThreads.reduce((count, thread) => {
    const threadCount = (thread.comments ?? []).filter((comment) => comment.body?.trim()).length;
    return count + threadCount;
  }, 0);
  const prComments = (data.comments ?? []).filter((comment) => comment.body?.trim()).length;
  return reviewBodies + threadBodies + prComments;
}

async function replyToFeedbackItems(prNumber: number, items: ReviewFeedbackItem[]): Promise<void> {
  const replyBody = "Addressed in latest commit.";
  let repliedCount = 0;

  for (const item of items) {
    try {
      if (item.source === "thread" && typeof item.commentId === "number") {
        await replyToReviewComment(prNumber, item.commentId, replyBody);
        repliedCount++;
      } else if (item.source === "comment" && item.commentId) {
        // PR comments don't support threading, so we add a general comment
        await addPrComment(prNumber, `@${item.author} ${replyBody}`);
        repliedCount++;
      }
      // Skip reviews - they don't have a direct reply mechanism
    } catch {
      // Silently ignore reply failures - non-critical
    }
  }

  if (repliedCount > 0) {
    logger.dim(`Replied to ${repliedCount} feedback item${repliedCount > 1 ? "s" : ""}.`);
  }
}
