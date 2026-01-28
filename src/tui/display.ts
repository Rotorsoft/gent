import chalk from "chalk";
import type { TuiState } from "./state.js";
import type { TuiAction } from "./actions.js";
import { getProviderDisplayName } from "../lib/ai-provider.js";
import { getVersion } from "../lib/version.js";

// eslint-disable-next-line no-control-regex
const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, "");
const visibleLength = (str: string) => stripAnsi(str).length;

function padRight(str: string, len: number): string {
  const visible = visibleLength(str);
  return str + " ".repeat(Math.max(0, len - visible));
}

function getTerminalWidth(): number {
  return Math.min(process.stdout.columns || 80, 100);
}

function renderPanel(title: string, lines: string[]): void {
  const width = getTerminalWidth() - 2;
  const inner = width - 2;
  const titleStr = ` ${title} `;
  const topBorderRight = "─".repeat(Math.max(0, width - titleStr.length - 1));

  console.log(chalk.dim("┌") + chalk.bold.cyan(titleStr) + chalk.dim(topBorderRight + "┐"));
  for (const line of lines) {
    console.log(chalk.dim("│") + " " + padRight(line, inner - 1) + chalk.dim("│"));
  }
  console.log(chalk.dim("└" + "─".repeat(width) + "┘"));
}

function formatWorkflowBadge(status: string): string {
  switch (status) {
    case "ready":
      return chalk.bgGreen.black(" READY ");
    case "in-progress":
      return chalk.bgYellow.black(" IN PROGRESS ");
    case "completed":
      return chalk.bgBlue.white(" COMPLETED ");
    case "blocked":
      return chalk.bgRed.white(" BLOCKED ");
    default:
      return "";
  }
}

function formatPrState(state: "open" | "closed" | "merged", isDraft: boolean): string {
  if (state === "merged") return chalk.bgMagenta.white(" MERGED ");
  if (state === "closed") return chalk.bgRed.white(" CLOSED ");
  return isDraft ? chalk.bgYellow.black(" DRAFT ") : chalk.bgGreen.black(" OPEN ");
}

function formatReviewBadge(decision: string | null): string {
  if (!decision) return "";
  switch (decision) {
    case "APPROVED":
      return chalk.green(" Approved");
    case "CHANGES_REQUESTED":
      return chalk.red(" Changes requested");
    case "REVIEW_REQUIRED":
      return chalk.yellow(" Review required");
    default:
      return "";
  }
}

export function renderDashboard(state: TuiState): void {
  const version = getVersion();
  const providerName = getProviderDisplayName(state.config.ai.provider);
  const providerOk = state.isAIProviderAvailable ? chalk.green(providerName) : chalk.red(providerName);
  const ghStatus = state.isGhAuthenticated ? chalk.green("gh") : chalk.red("gh");

  // Header line
  const left = chalk.bold(" Gent ") + chalk.dim(`v${version}`);
  const right = providerOk + chalk.dim(" | ") + ghStatus + " ";
  const headerPad = Math.max(0, getTerminalWidth() - visibleLength(left) - visibleLength(right));
  console.log(left + " ".repeat(headerPad) + right);
  console.log();

  // Prerequisites errors
  if (!state.isGitRepo) {
    renderPanel("Setup Required", [
      chalk.red("Not a git repository"),
      chalk.dim("Initialize with: gent init"),
    ]);
    return;
  }

  if (!state.isGhAuthenticated) {
    renderPanel("Setup Required", [
      chalk.red("GitHub CLI not authenticated"),
      chalk.dim("Run: gh auth login"),
    ]);
    return;
  }

  // When on main with nothing current
  if (state.isOnMain) {
    renderPanel("Branch", [
      chalk.magenta(state.branch) + chalk.dim("  Ready to start new work"),
      ...(state.hasUncommittedChanges ? [chalk.yellow("uncommitted changes")] : []),
    ]);
    console.log();
    renderPanel("Workflow", [
      chalk.dim("No active ticket. Start by creating or implementing an issue."),
    ]);
    console.log();
    return;
  }

  // ---- Ticket panel ----
  if (state.issue) {
    const labelParts: string[] = [];
    const typeLabel = state.issue.labels.find((l) => l.startsWith("type:"));
    const priorityLabel = state.issue.labels.find((l) => l.startsWith("priority:"));
    const riskLabel = state.issue.labels.find((l) => l.startsWith("risk:"));
    const areaLabel = state.issue.labels.find((l) => l.startsWith("area:"));
    if (typeLabel) labelParts.push(chalk.dim(typeLabel));
    if (priorityLabel) labelParts.push(chalk.dim(priorityLabel));
    if (riskLabel) labelParts.push(chalk.dim(riskLabel));
    if (areaLabel) labelParts.push(chalk.dim(areaLabel));

    const ticketLines: string[] = [
      chalk.cyan(`#${state.issue.number}`) + "  " + chalk.bold(state.issue.title),
    ];
    if (state.workflowStatus !== "none") {
      ticketLines.push(formatWorkflowBadge(state.workflowStatus) + "  " + labelParts.join("  "));
    } else if (labelParts.length > 0) {
      ticketLines.push(labelParts.join("  "));
    }
    renderPanel("Ticket", ticketLines);
  } else {
    renderPanel("Ticket", [chalk.dim("No linked issue found")]);
  }
  console.log();

  // ---- Branch panel ----
  const branchIndicators: string[] = [];
  if (state.commits.length > 0) {
    branchIndicators.push(chalk.dim(`${state.commits.length} commit${state.commits.length !== 1 ? "s" : ""} ahead of ${state.baseBranch}`));
  }
  if (state.hasUncommittedChanges) {
    branchIndicators.push(chalk.yellow("● uncommitted"));
  }
  if (state.hasUnpushedCommits) {
    branchIndicators.push(chalk.yellow("● unpushed"));
  }
  if (!state.hasUncommittedChanges && !state.hasUnpushedCommits && state.commits.length > 0) {
    branchIndicators.push(chalk.green("● synced"));
  }

  renderPanel("Branch", [
    chalk.magenta(state.branch),
    ...(branchIndicators.length > 0 ? [branchIndicators.join("  ")] : []),
  ]);
  console.log();

  // ---- PR panel ----
  if (state.pr) {
    const prLines: string[] = [
      chalk.cyan(`#${state.pr.number}`) + "  " + formatPrState(state.pr.state, state.pr.isDraft) + formatReviewBadge(state.pr.reviewDecision),
    ];
    if (state.hasActionableFeedback) {
      prLines.push(chalk.yellow(`${state.reviewFeedback.length} actionable comment${state.reviewFeedback.length !== 1 ? "s" : ""} pending`));
    }
    if (state.hasUIChanges && state.isPlaywrightAvailable && state.config.video.enabled && state.pr.state === "open") {
      prLines.push(chalk.cyan("UI changes detected") + chalk.dim(" - video capture available"));
    }
    prLines.push(chalk.dim(state.pr.url));
    renderPanel("Pull Request", prLines);
  } else {
    renderPanel("Pull Request", [chalk.dim("No PR created yet")]);
  }
  console.log();

  // ---- Commits panel ----
  if (state.commits.length > 0) {
    const maxCommits = 8;
    const displayCommits = state.commits.slice(0, maxCommits).map((c) => chalk.dim("  ") + c);
    if (state.commits.length > maxCommits) {
      displayCommits.push(chalk.dim(`  ... and ${state.commits.length - maxCommits} more`));
    }
    renderPanel("Commits", displayCommits);
  } else {
    renderPanel("Commits", [chalk.dim("No commits yet")]);
  }
  console.log();
}

export function renderCommandBar(actions: TuiAction[]): void {
  const shortcuts = actions.map((a) => {
    return chalk.bold(`[${a.shortcut}]`) + " " + a.label;
  });

  // Wrap shortcuts into lines that fit terminal width
  const width = getTerminalWidth();
  const lines: string[] = [];
  let currentLine = " ";

  for (const shortcut of shortcuts) {
    const candidate = currentLine + (currentLine.length > 1 ? "   " : "") + shortcut;
    if (visibleLength(candidate) > width - 2) {
      lines.push(currentLine);
      currentLine = " " + shortcut;
    } else {
      currentLine = candidate;
    }
  }
  if (currentLine.length > 1) {
    lines.push(currentLine);
  }

  for (const line of lines) {
    console.log(line);
  }
}

export function renderHint(message: string): void {
  console.log(chalk.dim(` ${message}`));
}

export function clearScreen(): void {
  process.stdout.write("\x1B[2J\x1B[0f");
}
