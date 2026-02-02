import chalk from "chalk";
import { getProviderDisplayName } from "../lib/ai-provider.js";
import { getVersion, type VersionCheckResult } from "../lib/version.js";
import type { TuiAction } from "./actions.js";
import type { TuiState } from "./state.js";

// eslint-disable-next-line no-control-regex
export const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, "");
export const visibleLen = (str: string) => stripAnsi(str).length;

export function truncateAnsi(text: string, max: number): string {
  if (visibleLen(text) <= max) return text;
  // Walk through the string, tracking visible characters
  let visible = 0;
  let i = 0;
  while (i < text.length && visible < max - 1) {
    if (text[i] === "\x1b") {
      // Skip ANSI escape sequence
      const end = text.indexOf("m", i);
      if (end !== -1) {
        i = end + 1;
        continue;
      }
    }
    visible++;
    i++;
  }
  // Include any trailing ANSI reset sequences
  return text.slice(0, i) + "\x1b[0m…";
}

export function termWidth(): number {
  return Math.min(process.stdout.columns || 80, 90);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

export function extractDescriptionLines(
  body: string,
  maxLen: number,
  maxLines = 3
): string[] {
  const result: string[] = [];
  const lines = body.split("\n");
  for (const line of lines) {
    if (result.length >= maxLines) break;
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("---")) continue;
    if (trimmed.startsWith("META:")) continue;
    if (trimmed.startsWith("**Type:**")) continue;
    if (trimmed.startsWith("**Category:**")) continue;
    if (trimmed.startsWith("**Priority:**")) continue;
    if (trimmed.startsWith("**Risk:**")) continue;
    const clean = trimmed
      .replace(/\*\*/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    result.push(truncate(clean, maxLen));
  }
  return result;
}

// ── Box drawing ─────────────────────────────────────────────────

function topRow(title: string, w: number): string {
  const label = ` ${title} `;
  const fill = w - 2 - label.length;
  return (
    chalk.dim("┌") +
    chalk.bold.cyan(label) +
    chalk.dim("─".repeat(Math.max(0, fill)) + "┐")
  );
}

function midRow(title: string, w: number): string {
  const label = ` ${title} `;
  const fill = w - 2 - label.length;
  return (
    chalk.dim("├") +
    chalk.bold.cyan(label) +
    chalk.dim("─".repeat(Math.max(0, fill)) + "┤")
  );
}

function divRow(w: number): string {
  return chalk.dim("├" + "─".repeat(w - 2) + "┤");
}

function botRow(w: number): string {
  return chalk.dim("└" + "─".repeat(w - 2) + "┘");
}

function row(text: string, w: number): string {
  const inner = w - 4;
  const fitted = truncateAnsi(text, inner);
  const pad = Math.max(0, inner - visibleLen(fitted));
  return chalk.dim("│") + " " + fitted + " ".repeat(pad) + " " + chalk.dim("│");
}

// ── Formatters ──────────────────────────────────────────────────

function workflowBadge(status: string): string {
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

function prBadge(state: "open" | "closed" | "merged", draft: boolean): string {
  if (state === "merged") return chalk.bgMagenta.white(" MERGED ");
  if (state === "closed") return chalk.bgRed.white(" CLOSED ");
  return draft
    ? chalk.bgYellow.black(" DRAFT ")
    : chalk.bgGreen.black(" OPEN ");
}

function reviewBadge(decision: string | null): string {
  if (!decision) return "";
  switch (decision) {
    case "APPROVED":
      return "  " + chalk.green("Approved");
    case "CHANGES_REQUESTED":
      return "  " + chalk.red("Changes requested");
    case "REVIEW_REQUIRED":
      return "  " + chalk.yellow("Review pending");
    default:
      return "";
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
  const idx = a.label.indexOf(a.shortcut);
  const styledKey = color(chalk.underline(a.shortcut));
  if (idx >= 0) {
    const before = a.label.slice(0, idx);
    const after = a.label.slice(idx + a.shortcut.length);
    return chalk.dim(before) + styledKey + chalk.dim(after);
  }
  return styledKey + " " + chalk.dim(a.label);
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

// ── Dashboard line builder ──────────────────────────────────────

type Out = (line: string) => void;

function renderSettingsTo(
  state: TuiState,
  w: number,
  out: Out,
  versionCheck?: VersionCheckResult | null
): void {
  const provider = getProviderDisplayName(state.config.ai.provider);
  const provTag = state.isAIProviderAvailable
    ? chalk.green(provider)
    : chalk.red(provider);
  const ghTag = state.isGhAuthenticated
    ? chalk.green("authenticated")
    : chalk.red("not authenticated");

  out(row(chalk.dim("Provider: ") + provTag, w));
  out(row(chalk.dim("GitHub:   ") + ghTag, w));

  if (versionCheck?.updateAvailable && versionCheck.latestVersion) {
    out(
      row(
        chalk.yellow(
          `Update available: ${versionCheck.currentVersion} → ${versionCheck.latestVersion}`
        ) +
          chalk.dim(' — run "npm install -g @rotorsoft/gent" to upgrade'),
        w
      )
    );
  }
}

/**
 * Build dashboard output as an array of strings.
 * Used by modals to capture dashboard state for overlay rendering.
 */
export function buildDashboardLines(
  state: TuiState,
  actions: TuiAction[],
  hint?: string,
  refreshing?: boolean,
  versionCheck?: VersionCheckResult | null
): string[] {
  const lines: string[] = [];
  const out: Out = (line: string) => lines.push(line);
  const w = termWidth();
  const descMax = w - 8;
  const version = getVersion();

  const titleLabel = `gent v${version}`;
  out(topRow(titleLabel, w));
  renderSettingsTo(state, w, out, versionCheck);

  // ── Error states ──────────────────────────────────────────────
  if (!state.isGitRepo) {
    out(row(chalk.yellow("Not a git repository"), w));
    out(row(chalk.dim("Navigate to a git repository to get started"), w));
    out(divRow(w));
    for (const line of formatCommandBar(actions, w)) {
      out(row(line, w));
    }
    out(botRow(w));
    return lines;
  }
  if (!state.isGhAuthenticated) {
    out(row(chalk.red("GitHub CLI not authenticated"), w));
    out(row(chalk.dim("Run: gh auth login"), w));
    out(divRow(w));
    for (const line of formatCommandBar(actions, w)) {
      out(row(line, w));
    }
    out(botRow(w));
    return lines;
  }

  const section = (title: string) => {
    out(midRow(title, w));
  };

  // Ticket
  if (state.issue || !state.isOnMain) {
    section("Ticket");
    if (state.issue) {
      out(
        row(
          chalk.dim("· ") +
            chalk.cyan(`#${state.issue.number}`) +
            " " +
            chalk.bold(state.issue.title),
          w
        )
      );
      const descLines = extractDescriptionLines(state.issue.body, descMax);
      for (const desc of descLines) {
        out(row("  " + chalk.dim(desc), w));
      }
      const tags: string[] = [];
      if (state.workflowStatus !== "none")
        tags.push(workflowBadge(state.workflowStatus));
      for (const prefix of ["type:", "priority:", "risk:", "area:"]) {
        const l = state.issue.labels.find((x) => x.startsWith(prefix));
        if (l) tags.push(chalk.dim(l));
      }
      if (tags.length) out(row("  " + tags.join("  "), w));
    } else {
      out(row(chalk.dim("  No linked issue"), w));
    }
  }

  // Branch
  section("Branch");
  let branchLine = chalk.dim("· ") + chalk.magenta(state.branch);
  if (state.isOnMain && !state.hasUncommittedChanges) {
    branchLine += chalk.dim("  ·  ready to start new work");
  }
  out(row(branchLine, w));

  const bits: string[] = [];
  if (state.commits.length > 0)
    bits.push(chalk.dim(`${state.commits.length} ahead`));
  if (state.hasUncommittedChanges) bits.push(chalk.yellow("● uncommitted"));
  if (state.hasUnpushedCommits) bits.push(chalk.yellow("● unpushed"));
  if (
    !state.hasUncommittedChanges &&
    !state.hasUnpushedCommits &&
    state.commits.length > 0
  ) {
    bits.push(chalk.green("● synced"));
  }
  if (bits.length) out(row("  " + bits.join(chalk.dim("  ·  ")), w));

  // Pull Request
  if (state.pr || !state.isOnMain) {
    section("Pull Request");
    if (state.pr) {
      const titleText = state.pr.title ? " " + state.pr.title : "";
      out(
        row(
          chalk.dim("· ") + chalk.cyan(`#${state.pr.number}`) + titleText,
          w
        )
      );
      out(
        row(
          "  " +
            prBadge(state.pr.state, state.pr.isDraft) +
            reviewBadge(state.pr.reviewDecision),
          w
        )
      );
      if (state.hasActionableFeedback) {
        const n = state.reviewFeedback.length;
        out(
          row(
            "  " +
              chalk.yellow(`${n} actionable comment${n !== 1 ? "s" : ""} pending`),
            w
          )
        );
      }
      if (
        state.hasUIChanges &&
        state.isPlaywrightAvailable &&
        state.config.video.enabled &&
        state.pr.state === "open"
      ) {
        out(
          row(
            "  " +
              chalk.cyan("UI changes detected") +
              chalk.dim(" · video capture available"),
            w
          )
        );
      }
      out(row("  " + chalk.dim(state.pr.url), w));
    } else {
      out(row(chalk.dim("  No PR created"), w));
    }
  }

  // Commits
  if (state.commits.length > 0 || !state.isOnMain) {
    section("Commits");
    if (state.commits.length > 0) {
      const max = 6;
      for (const c of state.commits.slice(0, max)) {
        out(row(chalk.dim("· ") + c, w));
      }
      if (state.commits.length > max) {
        out(row(chalk.dim(`  … and ${state.commits.length - max} more`), w));
      }
    } else {
      out(row(chalk.dim("  No commits"), w));
    }
  }

  // Setup hints (take priority over other hints)
  if (!state.hasConfig) {
    section("Setup");
    out(row(chalk.yellow('Run "gent init" to set up this repository'), w));
    out(row(chalk.dim("Press [i] to initialize"), w));
  } else if (state.hasValidRemote && !state.hasLabels) {
    section("Setup");
    out(row(chalk.yellow('Run "gent setup-labels" to create required GitHub labels'), w));
    out(row(chalk.dim("Press [b] to set up labels"), w));
  } else if (!state.hasValidRemote) {
    section("Hint");
    out(
      row(
        chalk.yellow(
          "Press [g] to create a GitHub repo and push"
        ),
        w
      )
    );
  } else if (hint) {
    section("Hint");
    out(row(chalk.yellow(hint), w));
  }

  // Command bar (inside the frame)
  out(divRow(w));
  if (refreshing) {
    out(row(chalk.yellow("Refreshing…"), w));
  } else {
    for (const line of formatCommandBar(actions, w)) {
      out(row(line, w));
    }
  }
  out(botRow(w));

  return lines;
}

// ── Main render ─────────────────────────────────────────────────

export function renderDashboard(
  state: TuiState,
  actions: TuiAction[],
  hint?: string,
  refreshing?: boolean,
  versionCheck?: VersionCheckResult | null
): void {
  const lines = buildDashboardLines(state, actions, hint, refreshing, versionCheck);
  for (const line of lines) {
    console.log(line);
  }
}

export function clearScreen(): void {
  process.stdout.write("\x1B[2J\x1B[0f");
}
