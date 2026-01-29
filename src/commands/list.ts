import chalk from "chalk";
import { logger, colors } from "../utils/logger.js";
import { loadConfig } from "../lib/config.js";
import { listIssues } from "../lib/github.js";
import { getWorkflowLabels, sortByPriority, extractPriorityFromLabels, extractTypeFromLabels } from "../lib/labels.js";
import { checkGhAuth } from "../utils/validators.js";
import type { GitHubIssue } from "../types/index.js";

export interface ListOptions {
  label?: string;
  status?: "ready" | "in-progress" | "completed" | "blocked" | "all";
  limit?: number;
}

export async function listCommand(options: ListOptions): Promise<void> {
  // Check gh auth
  const isAuthed = await checkGhAuth();
  if (!isAuthed) {
    logger.error("Not authenticated with GitHub. Run 'gh auth login' first.");
    process.exit(1);
  }

  const config = loadConfig();
  const workflowLabels = getWorkflowLabels(config);

  // Build label filter
  const labels: string[] = [];

  if (options.label) {
    labels.push(options.label);
  }

  if (options.status && options.status !== "all") {
    switch (options.status) {
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
  } else if (!options.status) {
    // Default to showing ai-ready issues
    labels.push(workflowLabels.ready);
  }

  let issues: GitHubIssue[];
  try {
    issues = await listIssues({
      labels: labels.length > 0 ? labels : undefined,
      state: "open",
      limit: options.limit || 20,
    });
  } catch (error) {
    logger.error(`Failed to fetch issues: ${error}`);
    return;
  }

  if (issues.length === 0) {
    logger.info("No issues found matching the criteria.");
    return;
  }

  // Sort by priority
  sortByPriority(issues);

  logger.bold(`Found ${issues.length} issue(s):`);
  logger.newline();

  for (const issue of issues) {
    const type = extractTypeFromLabels(issue.labels);
    const priority = extractPriorityFromLabels(issue.labels);
    const status = getIssueStatus(issue.labels, workflowLabels);

    const priorityColor = getPriorityColor(priority);
    const statusColor = getStatusColor(status);

    console.log(
      `  ${colors.issue(`#${issue.number.toString().padStart(4)}`)} ` +
        `${priorityColor(`[${priority}]`.padEnd(10))} ` +
        `${statusColor(`[${status}]`.padEnd(14))} ` +
        `${colors.label(`[${type}]`.padEnd(10))} ` +
        issue.title.slice(0, 50) +
        (issue.title.length > 50 ? "..." : "")
    );
  }

  logger.newline();
  logger.dim(`Run ${colors.command("gent run <issue-number>")} to implement an issue`);
  logger.dim(`Run ${colors.command("gent switch")} to browse and switch to a ticket`);
}

function getIssueStatus(
  labels: string[],
  workflowLabels: ReturnType<typeof getWorkflowLabels>
): string {
  if (labels.includes(workflowLabels.ready)) return "ready";
  if (labels.includes(workflowLabels.inProgress)) return "in-progress";
  if (labels.includes(workflowLabels.completed)) return "completed";
  if (labels.includes(workflowLabels.blocked)) return "blocked";
  return "unknown";
}

function getPriorityColor(priority: string): (text: string) => string {
  switch (priority) {
    case "critical":
      return chalk.red;
    case "high":
      return chalk.yellow;
    case "medium":
      return chalk.blue;
    case "low":
      return chalk.green;
    default:
      return chalk.gray;
  }
}

function getStatusColor(status: string): (text: string) => string {
  switch (status) {
    case "ready":
      return chalk.green;
    case "in-progress":
      return chalk.yellow;
    case "completed":
      return chalk.blue;
    case "blocked":
      return chalk.red;
    default:
      return chalk.gray;
  }
}
