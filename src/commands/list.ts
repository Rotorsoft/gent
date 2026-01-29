import chalk from "chalk";
import inquirer from "inquirer";
import { logger, colors } from "../utils/logger.js";
import { withSpinner } from "../utils/spinner.js";
import { loadConfig } from "../lib/config.js";
import { listIssues, listOpenPrs, type OpenPr } from "../lib/github.js";
import {
  getCurrentBranch,
  getDefaultBranch,
  hasUncommittedChanges,
  branchExists,
  checkoutBranch,
  createBranch,
  listLocalBranches,
  remoteBranchExists,
  fetchAndCheckout,
} from "../lib/git.js";
import { parseBranchName, generateBranchName } from "../lib/branch.js";
import { getWorkflowLabels, sortByPriority } from "../lib/labels.js";
import { checkGhAuth } from "../utils/validators.js";
import type { GitHubIssue } from "../types/index.js";

export interface ListOptions {
  label?: string;
  status?: "ready" | "in-progress" | "completed" | "blocked" | "all";
  limit?: number;
}

export interface TicketChoice {
  issueNumber: number;
  title: string;
  branch: string | null;
  category: "in-progress" | "open-pr" | "ready";
}

/**
 * Find the local branch associated with an issue number by scanning all local branches.
 */
export function findBranchForIssue(
  issueNumber: number,
  branches: string[]
): string | null {
  for (const branch of branches) {
    const info = parseBranchName(branch);
    if (info && info.issueNumber === issueNumber) {
      return branch;
    }
  }
  return null;
}

/**
 * Build categorized ticket choices from GitHub data and local branches.
 */
export function buildTicketChoices(
  inProgressIssues: GitHubIssue[],
  readyIssues: GitHubIssue[],
  openPrs: OpenPr[],
  localBranches: string[]
): TicketChoice[] {
  const choices: TicketChoice[] = [];
  const seen = new Set<number>();

  // Map PR branches to issue numbers
  const prByIssue = new Map<number, OpenPr>();
  for (const pr of openPrs) {
    const info = parseBranchName(pr.headRefName);
    if (info) {
      prByIssue.set(info.issueNumber, pr);
    }
  }

  // In-progress issues first
  for (const issue of inProgressIssues) {
    if (seen.has(issue.number)) continue;
    seen.add(issue.number);
    const branch = findBranchForIssue(issue.number, localBranches);
    const pr = prByIssue.get(issue.number);
    choices.push({
      issueNumber: issue.number,
      title: issue.title,
      branch: branch || pr?.headRefName || null,
      category: pr ? "open-pr" : "in-progress",
    });
  }

  // Issues with open PRs (not already added)
  for (const [issueNumber, pr] of prByIssue) {
    if (seen.has(issueNumber)) continue;
    seen.add(issueNumber);
    const issue = [...inProgressIssues, ...readyIssues].find(
      (i) => i.number === issueNumber
    );
    choices.push({
      issueNumber,
      title: issue?.title || pr.title,
      branch: pr.headRefName,
      category: "open-pr",
    });
  }

  // Ready issues
  for (const issue of readyIssues) {
    if (seen.has(issue.number)) continue;
    seen.add(issue.number);
    const branch = findBranchForIssue(issue.number, localBranches);
    choices.push({
      issueNumber: issue.number,
      title: issue.title,
      branch,
      category: "ready",
    });
  }

  return choices;
}

function categoryLabel(category: TicketChoice["category"]): string {
  switch (category) {
    case "in-progress":
      return chalk.yellow("[in progress]");
    case "open-pr":
      return chalk.blue("[open PR]");
    case "ready":
      return chalk.green("[ready]");
  }
}

function formatChoice(choice: TicketChoice): string {
  const num = colors.issue(`#${choice.issueNumber}`);
  const cat = categoryLabel(choice.category);
  const title =
    choice.title.length > 50 ? choice.title.slice(0, 50) + "..." : choice.title;
  return `${num} ${cat} ${title}`;
}

export async function listCommand(options: ListOptions): Promise<void> {
  const isAuthed = await checkGhAuth();
  if (!isAuthed) {
    logger.error("Not authenticated with GitHub. Run 'gh auth login' first.");
    return;
  }

  const config = loadConfig();
  const workflowLabels = getWorkflowLabels(config);
  const currentBranch = await getCurrentBranch();
  const defaultBranch = await getDefaultBranch();

  // Determine which categories to fetch based on status filter
  const statusFilter = options.status;
  const limit = options.limit || 20;

  let inProgressIssues: GitHubIssue[] = [];
  let readyIssues: GitHubIssue[] = [];

  if (statusFilter && statusFilter !== "all") {
    // Filtered mode: fetch only the requested status
    const labels: string[] = [];
    if (options.label) labels.push(options.label);

    switch (statusFilter) {
      case "ready":
        labels.push(workflowLabels.ready);
        break;
      case "in-progress":
        labels.push(workflowLabels.inProgress);
        break;
      case "completed":
        labels.push(workflowLabels.completed);
        break;
      case "blocked":
        labels.push(workflowLabels.blocked);
        break;
    }

    const [issues, localBranches] = await withSpinner(
      "Fetching tickets...",
      () =>
        Promise.all([
          listIssues({ labels, state: "open", limit }),
          listLocalBranches(),
        ])
    );

    sortByPriority(issues);

    // Map filtered issues into the right category
    if (statusFilter === "in-progress") {
      inProgressIssues = issues;
    } else {
      readyIssues = issues;
    }

    const choices = buildTicketChoices(
      inProgressIssues,
      readyIssues,
      [],
      localBranches
    );

    if (choices.length === 0) {
      logger.info("No issues found matching the criteria.");
      return;
    }

    await presentSelector(choices, currentBranch, defaultBranch, config);
    return;
  }

  // Default: fetch all active categories in parallel
  const labelFilter = options.label ? [options.label] : [];
  const [inProgress, ready, prs, localBranches] = await withSpinner(
    "Fetching tickets...",
    () =>
      Promise.all([
        listIssues({
          labels: [workflowLabels.inProgress, ...labelFilter],
          state: "open",
          limit,
        }),
        listIssues({
          labels: [workflowLabels.ready, ...labelFilter],
          state: "open",
          limit,
        }),
        listOpenPrs(30),
        listLocalBranches(),
      ])
  );

  sortByPriority(inProgress);
  sortByPriority(ready);

  const choices = buildTicketChoices(inProgress, ready, prs, localBranches);

  if (choices.length === 0) {
    logger.info("No tickets found.");
    logger.dim(
      `Create a ticket with ${colors.command("gent create")} or add the '${workflowLabels.ready}' label to an issue.`
    );
    return;
  }

  await presentSelector(choices, currentBranch, defaultBranch, config);
}

async function presentSelector(
  choices: TicketChoice[],
  currentBranch: string,
  defaultBranch: string,
  config: ReturnType<typeof loadConfig>
): Promise<void> {
  // Check for uncommitted changes before allowing switch
  const dirty = await hasUncommittedChanges();

  // Build inquirer choices with separator groups
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inquirerChoices: any[] = [];

  // Main/master option always first
  inquirerChoices.push({
    name: `${chalk.magenta(defaultBranch)}${currentBranch === defaultBranch ? chalk.dim(" (current)") : ""}`,
    value: "__main__",
  });
  inquirerChoices.push(new inquirer.Separator("─"));

  // Group by category
  const inProgress = choices.filter((c) => c.category === "in-progress");
  const openPrChoices = choices.filter((c) => c.category === "open-pr");
  const ready = choices.filter((c) => c.category === "ready");

  if (inProgress.length > 0) {
    inquirerChoices.push(new inquirer.Separator(chalk.yellow(" In Progress")));
    for (const c of inProgress) {
      inquirerChoices.push({
        name: formatChoice(c),
        value: String(c.issueNumber),
      });
    }
  }

  if (openPrChoices.length > 0) {
    inquirerChoices.push(new inquirer.Separator(chalk.blue(" Open PRs")));
    for (const c of openPrChoices) {
      inquirerChoices.push({
        name: formatChoice(c),
        value: String(c.issueNumber),
      });
    }
  }

  if (ready.length > 0) {
    inquirerChoices.push(new inquirer.Separator(chalk.green(" Ready")));
    for (const c of ready) {
      inquirerChoices.push({
        name: formatChoice(c),
        value: String(c.issueNumber),
      });
    }
  }

  const { selected } = await inquirer.prompt([
    {
      type: "list",
      name: "selected",
      message: "Select a ticket to switch to:",
      choices: inquirerChoices,
      pageSize: 20,
    },
  ]);

  // Handle main branch selection
  if (selected === "__main__") {
    if (currentBranch === defaultBranch) {
      logger.info(`Already on ${colors.branch(defaultBranch)}`);
      return;
    }
    if (dirty) {
      const ok = await confirmDirty();
      if (!ok) return;
    }
    await withSpinner(`Switching to ${defaultBranch}...`, async () => {
      await checkoutBranch(defaultBranch);
    });
    logger.success(`Switched to ${colors.branch(defaultBranch)}`);
    return;
  }

  // Find the selected ticket
  const issueNumber = parseInt(selected, 10);
  const ticket = choices.find((c) => c.issueNumber === issueNumber);
  if (!ticket) return;

  if (dirty) {
    const ok = await confirmDirty();
    if (!ok) return;
  }

  // Resolve branch
  const targetBranch = ticket.branch;

  if (targetBranch) {
    if (await branchExists(targetBranch)) {
      await withSpinner(`Switching to ${targetBranch}...`, async () => {
        await checkoutBranch(targetBranch);
      });
      logger.success(`Switched to ${colors.branch(targetBranch)}`);
    } else if (await remoteBranchExists(targetBranch)) {
      await withSpinner(`Fetching ${targetBranch} from remote...`, async () => {
        await fetchAndCheckout(targetBranch);
      });
      logger.success(`Fetched and switched to ${colors.branch(targetBranch)}`);
    } else {
      logger.warning(
        `Branch ${colors.branch(targetBranch)} not found locally or on remote.`
      );
      await offerCreateBranch(config, issueNumber, ticket.title);
    }
  } else {
    await offerCreateBranch(config, issueNumber, ticket.title);
  }
}

async function confirmDirty(): Promise<boolean> {
  logger.warning("You have uncommitted changes.");
  const { proceed } = await inquirer.prompt([
    {
      type: "confirm",
      name: "proceed",
      message: "Continue anyway? (changes will carry over to the new branch)",
      default: false,
    },
  ]);
  if (!proceed) {
    logger.info("Aborting. Please commit or stash your changes first.");
  }
  return proceed;
}

async function offerCreateBranch(
  config: Parameters<typeof generateBranchName>[0],
  issueNumber: number,
  title: string
): Promise<void> {
  const branchName = await generateBranchName(
    config,
    issueNumber,
    title,
    "feature"
  );

  const { create } = await inquirer.prompt([
    {
      type: "confirm",
      name: "create",
      message: `No branch exists. Create ${colors.branch(branchName)}?`,
      default: true,
    },
  ]);

  if (!create) return;

  const defaultBranch = await getDefaultBranch();
  await withSpinner(`Creating branch ${branchName}...`, async () => {
    await createBranch(branchName, defaultBranch);
  });
  logger.success(`Created and switched to ${colors.branch(branchName)}`);
}
