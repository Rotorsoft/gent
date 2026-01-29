import chalk from "chalk";
import { getProviderDisplayName } from "../lib/ai-provider.js";
import { getVersion } from "../lib/version.js";
import type { TuiAction } from "./actions.js";
import type { TuiState } from "./state.js";

// eslint-disable-next-line no-control-regex
const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, "");
const visibleLen = (str: string) => stripAnsi(str).length;

function termWidth(): number {
  return Math.min(process.stdout.columns || 80, 90);
}


function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

function extractDescription(body: string, maxLen: number): string {
  const lines = body.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("---")) continue;
    if (trimmed.startsWith("META:")) continue;
    if (trimmed.startsWith("**Type:**")) continue;
    const clean = trimmed.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    return truncate(clean, maxLen);
  }
  return "";
}

// ── Box drawing ─────────────────────────────────────────────────

function topRow(title: string, w: number): string {
  const label = ` ${title} `;
  const fill = w - 2 - label.length;
  return chalk.dim("┌") + chalk.bold.cyan(label) + chalk.dim("─".repeat(Math.max(0, fill)) + "┐");
}

function midRow(title: string, w: number): string {
  const label = ` ${title} `;
  const fill = w - 2 - label.length;
  return chalk.dim("├") + chalk.bold.cyan(label) + chalk.dim("─".repeat(Math.max(0, fill)) + "┤");
}

function divRow(w: number): string {
  return chalk.dim("├" + "─".repeat(w - 2) + "┤");
}

function botRow(w: number): string {
  return chalk.dim("└" + "─".repeat(w - 2) + "┘");
}

function row(text: string, w: number): string {
  const inner = w - 4;
  const pad = Math.max(0, inner - visibleLen(text));
  return chalk.dim("│") + " " + text + " ".repeat(pad) + " " + chalk.dim("│");
}

// ── Formatters ──────────────────────────────────────────────────

function workflowBadge(status: string): string {
  switch (status) {
    case "ready": return chalk.bgGreen.black(" READY ");
    case "in-progress": return chalk.bgYellow.black(" IN PROGRESS ");
    case "completed": return chalk.bgBlue.white(" COMPLETED ");
    case "blocked": return chalk.bgRed.white(" BLOCKED ");
    default: return "";
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
    case "APPROVED": return "  " + chalk.green("Approved");
    case "CHANGES_REQUESTED": return "  " + chalk.red("Changes requested");
    case "REVIEW_REQUIRED": return "  " + chalk.yellow("Review pending");
    default: return "";
  }
}

// Rotating color palette for shortcut keys
const shortcutColors = [
  chalk.cyan.bold,
  chalk.green.bold,
  chalk.yellow.bold,
  chalk.magenta.bold,
  chalk.blue.bold,
  chalk.red.bold,
];

function formatAction(a: TuiAction, color: (s: string) => string): string {
  const key = a.shortcut;
  const idx = a.label.indexOf(key);
  if (idx >= 0) {
    // Highlight the shortcut letter within the label
    const before = a.label.slice(0, idx);
    const after = a.label.slice(idx + key.length);
    return chalk.dim(before) + color(key) + chalk.dim(after);
  }
  // Shortcut not in label — show separately
  return color(key) + " " + chalk.dim(a.label);
}

function formatCommandBar(actions: TuiAction[], w: number): string[] {
  const parts = actions.map((a, i) => {
    const color = shortcutColors[i % shortcutColors.length];
    return formatAction(a, color);
  });
  const inner = w - 4;
  const lines: string[] = [];
  let cur = "";
  for (const part of parts) {
    const next = cur + (cur.length > 0 ? "   " : "") + part;
    if (visibleLen(next) > inner) {
      lines.push(cur);
      cur = part;
    } else {
      cur = next;
    }
  }
  if (cur.length > 0) lines.push(cur);
  return lines;
}


/**
 * Render a framed panel for action output.
 * Shows a titled box with multiline content, used for command results
 * and AI interaction status within the TUI.
 */
export function renderActionPanel(title: string, content: string[]): void {
  const w = termWidth();
  console.log(topRow(title, w));
  for (const line of content) {
    console.log(row(line, w));
  }
  console.log(botRow(w));
}

// ── Settings ────────────────────────────────────────────────────

function renderSettings(state: TuiState, w: number): void {
  const provider = getProviderDisplayName(state.config.ai.provider);
  const provTag = state.isAIProviderAvailable ? chalk.green(provider) : chalk.red(provider);
  const ghTag = state.isGhAuthenticated ? chalk.green("authenticated") : chalk.red("not authenticated");
  const videoTag = state.config.video.enabled ? chalk.green("on") : chalk.dim("off");

  console.log(row(chalk.dim("Provider: ") + provTag, w));
  console.log(row(chalk.dim("GitHub:   ") + ghTag, w));
  console.log(row(chalk.dim("Video:    ") + videoTag, w));
}

// ── Main render ─────────────────────────────────────────────────

export function renderDashboard(state: TuiState, actions: TuiAction[], hint?: string, refreshing?: boolean): void {
  const w = termWidth();
  const descMax = w - 8;
  const version = getVersion();

  const titleLabel = `gent v${version}`;
  console.log(topRow(titleLabel, w));
  renderSettings(state, w);

  // ── Error states ──────────────────────────────────────────────
  if (!state.isGitRepo) {
    console.log(row(chalk.red("Not a git repository"), w));
    console.log(row(chalk.dim("Run gent init in a git repo to get started"), w));
    console.log(botRow(w));
    return;
  }
  if (!state.isGhAuthenticated) {
    console.log(row(chalk.red("GitHub CLI not authenticated"), w));
    console.log(row(chalk.dim("Run: gh auth login"), w));
    console.log(botRow(w));
    return;
  }

  // ── On main – nothing active ─────────────────────────────────
  if (state.isOnMain) {
    console.log(row(chalk.magenta(state.branch) + chalk.dim("  ·  ready to start new work"), w));
    if (state.hasUncommittedChanges) {
      console.log(row(chalk.yellow("● uncommitted changes"), w));
    }
    console.log(midRow("Settings", w));
    renderSettings(state, w);
    if (hint) {
      console.log(midRow("Hint", w));
      console.log(row(chalk.yellow(hint), w));
    }
    console.log(divRow(w));
    if (refreshing) {
      console.log(row(chalk.yellow("Refreshing…"), w));
    } else {
      for (const line of formatCommandBar(actions, w)) {
        console.log(row(line, w));
      }
    }
    console.log(botRow(w));
    console.log();
    return;
  }

  // ── Feature branch dashboard ──────────────────────────────────
  const section = (title: string) => {
    console.log(midRow(title, w));
  };

  // Ticket
  section("Ticket");
  if (state.issue) {
    console.log(row(
      chalk.cyan(`#${state.issue.number}`) + "  " + chalk.bold(truncate(state.issue.title, descMax - 6)),
      w,
    ));
    const desc = extractDescription(state.issue.body, descMax);
    if (desc) console.log(row(chalk.dim(desc), w));
    const tags: string[] = [];
    if (state.workflowStatus !== "none") tags.push(workflowBadge(state.workflowStatus));
    for (const prefix of ["type:", "priority:", "risk:", "area:"]) {
      const l = state.issue.labels.find((x) => x.startsWith(prefix));
      if (l) tags.push(chalk.dim(l));
    }
    if (tags.length) console.log(row(tags.join("  "), w));
  } else {
    console.log(row(chalk.dim("No linked issue"), w));
  }

  // Branch
  section("Branch");
  console.log(row(chalk.magenta(state.branch), w));
  const bits: string[] = [];
  if (state.commits.length > 0) bits.push(chalk.dim(`${state.commits.length} ahead`));
  if (state.hasUncommittedChanges) bits.push(chalk.yellow("● uncommitted"));
  if (state.hasUnpushedCommits) bits.push(chalk.yellow("● unpushed"));
  if (!state.hasUncommittedChanges && !state.hasUnpushedCommits && state.commits.length > 0) {
    bits.push(chalk.green("● synced"));
  }
  if (bits.length) console.log(row(bits.join(chalk.dim("  ·  ")), w));

  // Pull Request
  section("Pull Request");
  if (state.pr) {
    const titleText = state.pr.title
      ? "  " + truncate(state.pr.title, descMax - 12)
      : "";
    console.log(row(
      chalk.cyan(`#${state.pr.number}`) + titleText,
      w,
    ));
    console.log(row(
      prBadge(state.pr.state, state.pr.isDraft) + reviewBadge(state.pr.reviewDecision),
      w,
    ));
    if (state.hasActionableFeedback) {
      const n = state.reviewFeedback.length;
      console.log(row(chalk.yellow(`${n} actionable comment${n !== 1 ? "s" : ""} pending`), w));
    }
    if (state.hasUIChanges && state.isPlaywrightAvailable && state.config.video.enabled && state.pr.state === "open") {
      console.log(row(chalk.cyan("UI changes detected") + chalk.dim(" · video capture available"), w));
    }
    console.log(row(chalk.dim(state.pr.url), w));
  } else {
    console.log(row(chalk.dim("No PR created"), w));
  }

  // Commits
  section("Commits");
  if (state.commits.length > 0) {
    const max = 6;
    for (const c of state.commits.slice(0, max)) {
      console.log(row(c, w));
    }
    if (state.commits.length > max) {
      console.log(row(chalk.dim(`… and ${state.commits.length - max} more`), w));
    }
  } else {
    console.log(row(chalk.dim("No commits"), w));
  }

  // Hint
  if (hint) {
    section("Hint");
    console.log(row(chalk.yellow(hint), w));
  }

  // Command bar (inside the frame)
  console.log(divRow(w));
  if (refreshing) {
    console.log(row(chalk.yellow("Refreshing…"), w));
  } else {
    for (const line of formatCommandBar(actions, w)) {
      console.log(row(line, w));
    }
  }
  console.log(botRow(w));
}

export function clearScreen(): void {
  process.stdout.write("\x1B[2J\x1B[0f");
}
