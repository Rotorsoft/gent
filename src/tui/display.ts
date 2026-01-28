import chalk from "chalk";
import type { TuiState } from "./state.js";
import type { TuiAction } from "./actions.js";
import { getProviderDisplayName } from "../lib/ai-provider.js";
import { getVersion } from "../lib/version.js";

// eslint-disable-next-line no-control-regex
const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, "");
const visibleLen = (str: string) => stripAnsi(str).length;

function termWidth(): number {
  return Math.min(process.stdout.columns || 80, 90);
}

// All box-drawing helpers produce lines of exactly `w` visible characters.
function topRow(title: string, w: number): string {
  const label = ` ${title} `;
  const fill = w - 2 - label.length; // 2 for ┌ and ┐
  return chalk.dim("┌") + chalk.bold.cyan(label) + chalk.dim("─".repeat(Math.max(0, fill)) + "┐");
}

function midRow(title: string, w: number): string {
  const label = ` ${title} `;
  const fill = w - 2 - label.length;
  return chalk.dim("├") + chalk.bold.cyan(label) + chalk.dim("─".repeat(Math.max(0, fill)) + "┤");
}

function botRow(w: number): string {
  return chalk.dim("└" + "─".repeat(w - 2) + "┘");
}

function contentRow(text: string, w: number): string {
  const inner = w - 4; // 2 for borders, 2 for padding spaces
  const vis = visibleLen(text);
  const pad = Math.max(0, inner - vis);
  return chalk.dim("│") + " " + text + " ".repeat(pad) + " " + chalk.dim("│");
}

// ── Formatters ──────────────────────────────────────────────────

function workflowBadge(status: string): string {
  switch (status) {
    case "ready":       return chalk.bgGreen.black(" READY ");
    case "in-progress": return chalk.bgYellow.black(" IN PROGRESS ");
    case "completed":   return chalk.bgBlue.white(" COMPLETED ");
    case "blocked":     return chalk.bgRed.white(" BLOCKED ");
    default:            return "";
  }
}

function prBadge(state: "open" | "closed" | "merged", draft: boolean): string {
  if (state === "merged") return chalk.bgMagenta.white(" MERGED ");
  if (state === "closed") return chalk.bgRed.white(" CLOSED ");
  return draft ? chalk.bgYellow.black(" DRAFT ") : chalk.bgGreen.black(" OPEN ");
}

function reviewBadge(decision: string | null): string {
  if (!decision) return "";
  switch (decision) {
    case "APPROVED":           return "  " + chalk.green("Approved");
    case "CHANGES_REQUESTED":  return "  " + chalk.red("Changes requested");
    case "REVIEW_REQUIRED":    return "  " + chalk.yellow("Review pending");
    default:                   return "";
  }
}

// ── Main render ─────────────────────────────────────────────────

export function renderDashboard(state: TuiState): void {
  const w = termWidth();
  const version = getVersion();

  // Header bar (outside the box)
  const provider = getProviderDisplayName(state.config.ai.provider);
  const provTag = state.isAIProviderAvailable ? chalk.green(provider) : chalk.red(provider);
  const ghTag = state.isGhAuthenticated ? chalk.green("gh") : chalk.red("gh");
  const left = chalk.bold(" gent ") + chalk.dim(`v${version}`);
  const right = provTag + chalk.dim(" · ") + ghTag + " ";
  const gap = Math.max(1, w - visibleLen(left) - visibleLen(right));
  console.log(left + " ".repeat(gap) + right);
  console.log();

  // ── Error states ──────────────────────────────────────────────
  if (!state.isGitRepo) {
    console.log(topRow("Setup", w));
    console.log(contentRow(chalk.red("Not a git repository"), w));
    console.log(contentRow(chalk.dim("Run gent init in a git repo to get started"), w));
    console.log(botRow(w));
    return;
  }
  if (!state.isGhAuthenticated) {
    console.log(topRow("Setup", w));
    console.log(contentRow(chalk.red("GitHub CLI not authenticated"), w));
    console.log(contentRow(chalk.dim("Run: gh auth login"), w));
    console.log(botRow(w));
    return;
  }

  // ── On main – nothing active ─────────────────────────────────
  if (state.isOnMain) {
    console.log(topRow("Branch", w));
    console.log(contentRow(chalk.magenta(state.branch) + chalk.dim("  ·  ready to start new work"), w));
    if (state.hasUncommittedChanges) {
      console.log(contentRow(chalk.yellow("● uncommitted changes"), w));
    }
    console.log(midRow("Workflow", w));
    console.log(contentRow(chalk.dim("No active ticket"), w));
    console.log(botRow(w));
    console.log();
    return;
  }

  // ── Feature branch dashboard ──────────────────────────────────
  let first = true;

  // Ticket section
  const section = (title: string) => {
    console.log(first ? topRow(title, w) : midRow(title, w));
    first = false;
  };

  section("Ticket");
  if (state.issue) {
    console.log(contentRow(
      chalk.cyan(`#${state.issue.number}`) + "  " + chalk.bold(state.issue.title),
      w,
    ));
    const tags: string[] = [];
    if (state.workflowStatus !== "none") tags.push(workflowBadge(state.workflowStatus));
    for (const prefix of ["type:", "priority:", "risk:", "area:"]) {
      const l = state.issue.labels.find((x) => x.startsWith(prefix));
      if (l) tags.push(chalk.dim(l));
    }
    if (tags.length) console.log(contentRow(tags.join("  "), w));
  } else {
    console.log(contentRow(chalk.dim("No linked issue"), w));
  }

  // Branch section
  section("Branch");
  console.log(contentRow(chalk.magenta(state.branch), w));
  const bits: string[] = [];
  if (state.commits.length > 0) {
    bits.push(chalk.dim(`${state.commits.length} ahead`));
  }
  if (state.hasUncommittedChanges) bits.push(chalk.yellow("● uncommitted"));
  if (state.hasUnpushedCommits) bits.push(chalk.yellow("● unpushed"));
  if (!state.hasUncommittedChanges && !state.hasUnpushedCommits && state.commits.length > 0) {
    bits.push(chalk.green("● synced"));
  }
  if (bits.length) console.log(contentRow(bits.join(chalk.dim("  ·  ")), w));

  // PR section
  section("Pull Request");
  if (state.pr) {
    console.log(contentRow(
      chalk.cyan(`#${state.pr.number}`) + "  " + prBadge(state.pr.state, state.pr.isDraft) + reviewBadge(state.pr.reviewDecision),
      w,
    ));
    if (state.hasActionableFeedback) {
      const n = state.reviewFeedback.length;
      console.log(contentRow(chalk.yellow(`${n} actionable comment${n !== 1 ? "s" : ""} pending`), w));
    }
    if (state.hasUIChanges && state.isPlaywrightAvailable && state.config.video.enabled && state.pr.state === "open") {
      console.log(contentRow(chalk.cyan("UI changes detected") + chalk.dim(" · video capture available"), w));
    }
    console.log(contentRow(chalk.dim(state.pr.url), w));
  } else {
    console.log(contentRow(chalk.dim("No PR created"), w));
  }

  // Commits section
  section("Commits");
  if (state.commits.length > 0) {
    const max = 6;
    for (const c of state.commits.slice(0, max)) {
      console.log(contentRow(c, w));
    }
    if (state.commits.length > max) {
      console.log(contentRow(chalk.dim(`… and ${state.commits.length - max} more`), w));
    }
  } else {
    console.log(contentRow(chalk.dim("No commits"), w));
  }

  console.log(botRow(w));
  console.log();
}

// ── Command bar ─────────────────────────────────────────────────

export function renderCommandBar(actions: TuiAction[]): void {
  const parts = actions.map((a) =>
    chalk.inverse(` ${a.shortcut} `) + " " + chalk.dim(a.label),
  );
  const w = termWidth();
  const lines: string[] = [];
  let cur = " ";
  for (const part of parts) {
    const next = cur + (cur.length > 1 ? "   " : "") + part;
    if (visibleLen(next) > w - 1) {
      lines.push(cur);
      cur = " " + part;
    } else {
      cur = next;
    }
  }
  if (cur.length > 1) lines.push(cur);
  for (const line of lines) console.log(line);
}

export function renderHint(message: string): void {
  console.log(chalk.dim(` ${message}`));
}

export function clearScreen(): void {
  process.stdout.write("\x1B[2J\x1B[0f");
}
