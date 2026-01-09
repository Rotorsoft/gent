import inquirer from "inquirer";
import { logger, colors } from "../utils/logger.js";
import { withSpinner } from "../utils/spinner.js";
import { loadConfig, loadAgentInstructions } from "../lib/config.js";
import { getIssue, listIssues, updateIssueLabels, addIssueComment } from "../lib/github.js";
import { invokeClaudeInteractive, buildImplementationPrompt } from "../lib/claude.js";
import { getCurrentBranch, isOnMainBranch, createBranch, branchExists, checkoutBranch, hasUncommittedChanges } from "../lib/git.js";
import { generateBranchName } from "../lib/branch.js";
import { getWorkflowLabels, extractTypeFromLabels, sortByPriority } from "../lib/labels.js";
import { readProgress } from "../lib/progress.js";
import { checkGhAuth, checkClaudeCli, isValidIssueNumber } from "../utils/validators.js";
import type { GitHubIssue } from "../types/index.js";

export interface RunOptions {
  auto?: boolean;
}

export async function runCommand(
  issueNumberArg: string | undefined,
  options: RunOptions
): Promise<void> {
  logger.bold("Running AI implementation workflow...");
  logger.newline();

  // Validate prerequisites
  const [ghAuth, claudeOk] = await Promise.all([checkGhAuth(), checkClaudeCli()]);

  if (!ghAuth) {
    logger.error("Not authenticated with GitHub. Run 'gh auth login' first.");
    process.exit(1);
  }

  if (!claudeOk) {
    logger.error("Claude CLI not found. Please install claude CLI first.");
    process.exit(1);
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
      process.exit(0);
    }
  }

  const config = loadConfig();
  const workflowLabels = getWorkflowLabels(config);

  // Get issue number
  let issueNumber: number;

  if (options.auto) {
    // Auto-select highest priority ai-ready issue
    const autoIssue = await autoSelectIssue(workflowLabels.ready);
    if (!autoIssue) {
      logger.error("No ai-ready issues found.");
      process.exit(1);
    }
    issueNumber = autoIssue.number;
    logger.info(`Auto-selected: ${colors.issue(`#${issueNumber}`)} - ${autoIssue.title}`);
  } else if (issueNumberArg) {
    if (!isValidIssueNumber(issueNumberArg)) {
      logger.error("Invalid issue number.");
      process.exit(1);
    }
    issueNumber = parseInt(issueNumberArg, 10);
  } else {
    logger.error("Please provide an issue number or use --auto");
    process.exit(1);
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
    logger.warning(`Issue #${issueNumber} does not have the '${workflowLabels.ready}' label.`);
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
  logger.box("Issue Details", `#${issue.number}: ${issue.title}
Labels: ${issue.labels.join(", ")}`);
  logger.newline();

  // Generate branch name
  const type = extractTypeFromLabels(issue.labels);
  const branchName = await generateBranchName(config, issueNumber, issue.title, type);

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
      logger.warning(`Not on main branch (currently on ${colors.branch(currentBranch)}).`);
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
    logger.success(`Updated issue labels: ${colors.label(workflowLabels.ready)} → ${colors.label(workflowLabels.inProgress)}`);
  } catch (error) {
    logger.warning(`Failed to update labels: ${error}`);
  }

  // Build Claude prompt
  const agentInstructions = loadAgentInstructions();
  const progressContent = readProgress(config);
  const prompt = buildImplementationPrompt(issue, agentInstructions, progressContent, config);

  logger.newline();
  logger.info("Starting Claude implementation session...");
  logger.dim("Claude will implement the feature and create a commit.");
  logger.dim("Review the changes before pushing.");
  logger.newline();

  // Invoke Claude interactively
  try {
    await invokeClaudeInteractive(prompt, config);
  } catch (error) {
    logger.error(`Claude session failed: ${error}`);
    // Don't exit - allow user to see what happened
  }

  // Post-completion
  logger.newline();
  logger.success("Claude session completed.");

  // Update labels to completed
  try {
    await updateIssueLabels(issueNumber, {
      add: [workflowLabels.completed],
      remove: [workflowLabels.inProgress],
    });
    logger.success(`Updated labels: ${colors.label(workflowLabels.inProgress)} → ${colors.label(workflowLabels.completed)}`);
  } catch (error) {
    logger.warning(`Failed to update labels: ${error}`);
  }

  // Post comment to issue
  try {
    await addIssueComment(
      issueNumber,
      `AI implementation completed on branch \`${branchName}\`.\n\nPlease review the changes and create a PR when ready.`
    );
    logger.success("Posted completion comment to issue");
  } catch (error) {
    logger.warning(`Failed to post comment: ${error}`);
  }

  logger.newline();
  logger.box("Next Steps", `1. Review changes: ${colors.command("git diff HEAD~1")}
2. Run tests: ${colors.command("npm test")}
3. Push branch: ${colors.command("git push -u origin " + branchName)}
4. Create PR: ${colors.command("gent pr")}`);
}

async function autoSelectIssue(readyLabel: string): Promise<GitHubIssue | null> {
  // Try critical first
  let issues = await listIssues({
    labels: [readyLabel, "priority:critical"],
    state: "open",
    limit: 1,
  });
  if (issues.length > 0) return issues[0];

  // Try high
  issues = await listIssues({
    labels: [readyLabel, "priority:high"],
    state: "open",
    limit: 1,
  });
  if (issues.length > 0) return issues[0];

  // Get any ai-ready and sort
  issues = await listIssues({
    labels: [readyLabel],
    state: "open",
    limit: 10,
  });

  if (issues.length === 0) return null;

  sortByPriority(issues);
  return issues[0];
}
