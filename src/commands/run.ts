import inquirer from "inquirer";
import { logger, colors } from "../utils/logger.js";
import { withSpinner, createSpinner, aiSpinnerText } from "../utils/spinner.js";
import { loadConfig, loadAgentInstructions } from "../lib/config.js";
import { getIssue, updateIssueLabels, addIssueComment } from "../lib/github.js";
import { buildImplementationPrompt } from "../lib/prompts.js";
import {
  runInteractiveSession,
  getProviderDisplayName,
} from "../lib/ai-provider.js";
import {
  getCurrentBranch,
  isOnMainBranch,
  createBranch,
  branchExists,
  checkoutBranch,
  hasUncommittedChanges,
  getCurrentCommitSha,
  hasNewCommits,
} from "../lib/git.js";
import { generateBranchName } from "../lib/branch.js";
import { getWorkflowLabels, extractTypeFromLabels } from "../lib/labels.js";
import { readProgress } from "../lib/progress.js";
import {
  checkGhAuth,
  checkAIProvider,
  isValidIssueNumber,
} from "../utils/validators.js";
import type { GitHubIssue, AIProvider } from "../types/index.js";

export interface RunOptions {
  provider?: AIProvider;
}

export async function runCommand(
  issueNumberArg: string | undefined,
  options: RunOptions
): Promise<void> {
  const config = loadConfig();

  // Determine which provider to use
  const provider = options.provider ?? config.ai.provider;
  const providerName = getProviderDisplayName(provider);

  // Validate prerequisites
  const [ghAuth, aiOk] = await Promise.all([
    checkGhAuth(),
    checkAIProvider(provider),
  ]);

  if (!ghAuth) {
    logger.error("Not authenticated with GitHub. Run 'gh auth login' first.");
    return;
  }

  if (!aiOk) {
    logger.error(
      `${providerName} CLI not found. Please install ${provider} CLI first.`
    );
    return;
  }

  // Check for uncommitted changes
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
      return;
    }
  }

  const workflowLabels = getWorkflowLabels(config);

  // Get issue number
  let issueNumber: number;

  if (issueNumberArg) {
    if (!isValidIssueNumber(issueNumberArg)) {
      logger.error("Invalid issue number.");
      return;
    }
    issueNumber = parseInt(issueNumberArg, 10);
  } else {
    logger.error(
      "Please provide an issue number. Use 'gent switch' to browse tickets."
    );
    return;
  }

  // Fetch issue details
  let issue: GitHubIssue;
  try {
    issue = await withSpinner("Fetching issue...", async () => {
      return getIssue(issueNumber);
    });
  } catch (error) {
    logger.error(`Failed to fetch issue #${issueNumber}: ${error}`);
    return;
  }

  // Verify issue has ai-ready label
  if (!issue.labels.includes(workflowLabels.ready)) {
    logger.warning(
      `Issue #${issueNumber} does not have the '${workflowLabels.ready}' label.`
    );
    const { proceed } = await inquirer.prompt([
      {
        type: "confirm",
        name: "proceed",
        message: "Continue anyway?",
        default: false,
      },
    ]);
    if (!proceed) {
      return;
    }
  }

  logger.newline();
  logger.table("Run Summary", [
    { key: "Issue", value: `${colors.issue(`#${issue.number}`)} ${issue.title}` },
    { key: "Labels", value: issue.labels.map((l) => colors.label(l)).join(", ") },
  ]);
  logger.newline();

  // Generate branch name
  const type = extractTypeFromLabels(issue.labels);
  const branchName = await generateBranchName(
    config,
    issueNumber,
    issue.title,
    type
  );

  // Handle branch
  const currentBranch = await getCurrentBranch();
  const onMain = await isOnMainBranch();

  if (await branchExists(branchName)) {
    logger.info(`Branch ${colors.branch(branchName)} already exists.`);
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "What would you like to do?",
        choices: [
          { name: "Continue on existing branch", value: "continue" },
          { name: "Delete and recreate branch", value: "recreate" },
          { name: "Cancel", value: "cancel" },
        ],
      },
    ]);

    if (action === "cancel") {
      return;
    } else if (action === "continue") {
      await checkoutBranch(branchName);
    } else {
      // Recreate would require deleting first - for safety, just checkout
      await checkoutBranch(branchName);
    }
  } else {
    if (!onMain) {
      logger.warning(
        `Not on main branch (currently on ${colors.branch(currentBranch)}).`
      );
      const { fromMain } = await inquirer.prompt([
        {
          type: "confirm",
          name: "fromMain",
          message: "Create branch from main instead?",
          default: true,
        },
      ]);

      if (fromMain) {
        await createBranch(branchName, "main");
      } else {
        await createBranch(branchName);
      }
    } else {
      await createBranch(branchName);
    }
    logger.success(`Created branch ${colors.branch(branchName)}`);
  }

  // Update issue labels
  try {
    await updateIssueLabels(issueNumber, {
      add: [workflowLabels.inProgress],
      remove: [workflowLabels.ready],
    });
    logger.success(
      `Updated issue labels: ${colors.label(workflowLabels.ready)} → ${colors.label(workflowLabels.inProgress)}`
    );
  } catch (error) {
    logger.warning(`Failed to update labels: ${error}`);
  }

  // Build implementation prompt
  const agentInstructions = loadAgentInstructions();
  const progressContent = readProgress(config);
  const prompt = buildImplementationPrompt(
    issue,
    agentInstructions,
    progressContent,
    config
  );

  logger.newline();
  const spinner = createSpinner(aiSpinnerText(providerName, "implement ticket"));
  spinner.start();

  // Capture commit SHA before AI runs
  const beforeSha = await getCurrentCommitSha();

  // Invoke AI interactively with robust signal handling
  spinner.stop();
  let aiExitCode: number | undefined;
  let wasCancelled = false;
  let usedProvider = provider;
  try {
    const session = await runInteractiveSession(
      prompt,
      config,
      options.provider
    );
    aiExitCode = session.exitCode;
    wasCancelled = session.signalCancelled;
    usedProvider = session.provider;
  } catch (error) {
    logger.error(
      `${getProviderDisplayName(usedProvider)} session failed: ${error}`
    );
    // Don't exit - allow user to see what happened
  }

  // Post-completion
  logger.newline();

  // Check if any new commits were created
  const commitsCreated = await hasNewCommits(beforeSha);

  // Handle cancellation - don't change labels
  if (wasCancelled) {
    logger.warning("Operation was cancelled. Labels unchanged.");
    return;
  }

  // Determine appropriate label based on whether work was done
  const usedProviderName = getProviderDisplayName(usedProvider);
  if (commitsCreated) {
    logger.success(`${usedProviderName} session completed with new commits.`);

    // Update labels to completed
    try {
      await updateIssueLabels(issueNumber, {
        add: [workflowLabels.completed],
        remove: [workflowLabels.inProgress],
      });
      logger.success(
        `Updated labels: ${colors.label(workflowLabels.inProgress)} → ${colors.label(workflowLabels.completed)}`
      );
    } catch (error) {
      logger.warning(`Failed to update labels: ${error}`);
    }

    // Post comment to issue
    try {
      await addIssueComment(
        issueNumber,
        `AI implementation completed on branch \`${branchName}\` using ${usedProviderName}.\n\nPlease review the changes and create a PR when ready.`
      );
      logger.success("Posted completion comment to issue");
    } catch (error) {
      logger.warning(`Failed to post comment: ${error}`);
    }
  } else {
    // No commits created - check if it was a rate limit or other issue
    // Exit code 2 typically indicates rate limiting for the AI provider CLI
    // Gemini may use different patterns
    const isRateLimited = aiExitCode === 2;

    if (isRateLimited) {
      logger.warning(
        `${usedProviderName} session ended due to rate limits. No commits were created.`
      );

      // Set ai-blocked label
      try {
        await updateIssueLabels(issueNumber, {
          add: [workflowLabels.blocked],
          remove: [workflowLabels.inProgress],
        });
        logger.info(
          `Updated labels: ${colors.label(workflowLabels.inProgress)} → ${colors.label(workflowLabels.blocked)}`
        );
      } catch (error) {
        logger.warning(`Failed to update labels: ${error}`);
      }

      // Post comment about rate limiting
      try {
        await addIssueComment(
          issueNumber,
          `AI implementation was blocked due to API rate limits on branch \`${branchName}\` (${usedProviderName}).\n\nNo commits were created. Please retry later.`
        );
        logger.info("Posted rate-limit comment to issue");
      } catch (error) {
        logger.warning(`Failed to post comment: ${error}`);
      }
    } else {
      logger.warning(
        `${usedProviderName} session completed but no commits were created. Labels unchanged.`
      );
      // Leave as ai-in-progress so it can be retried
    }

    return;
  }

  logger.newline();
  logger.box(
    "Next Steps",
    `1. Review changes: ${colors.command("git diff HEAD~1")}
2. Run tests: ${colors.command("npm test")}
3. Push branch: ${colors.command("git push -u origin " + branchName)}
4. Create PR: ${colors.command("gent pr")}`
  );
}
