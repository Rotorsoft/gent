import chalk from "chalk";
import { stripAnsi, visibleLen, truncateAnsi } from "./display.js";

// ── Re-exports ──────────────────────────────────────────────────
// Keep all dialog types accessible via modal.ts so existing
// consumers (tui.ts, tui.test.ts) don't need import changes.

export { readKey, type KeyPress } from "./key-reader.js";
export { showSelect, buildSelectContent, type SelectItem, type SelectSeparator, type SelectEntry, type SelectOptions } from "./select-dialog.js";
export { showConfirm, buildConfirmContent, type ConfirmOptions } from "./confirm-dialog.js";
export { showInput, buildInputContent, type InputOptions } from "./input-dialog.js";
export { showMultilineInput, buildMultilineInputContent } from "./multiline-input.js";

// ── Modal frame builders (pure, testable) ────────────────────────

function modalTopRow(title: string, w: number): string {
  const label = ` ${title} `;
  const fill = w - 2 - label.length;
  return (
    chalk.bold("┌") +
    chalk.bold.cyan(label) +
    chalk.bold("─".repeat(Math.max(0, fill)) + "┐")
  );
}

function modalDivRow(w: number): string {
  return chalk.bold("├" + "─".repeat(w - 2) + "┤");
}

function modalBotRow(w: number): string {
  return chalk.bold("└" + "─".repeat(w - 2) + "┘");
}

function modalRow(text: string, w: number): string {
  const inner = w - 4;
  const fitted = truncateAnsi(text, inner);
  const pad = Math.max(0, inner - visibleLen(fitted));
  return chalk.bold("│") + " " + fitted + " ".repeat(pad) + " " + chalk.bold("│");
}

function modalEmptyRow(w: number): string {
  return modalRow("", w);
}

/**
 * Build modal frame lines (pure function for testing).
 */
export function buildModalFrame(
  title: string,
  contentLines: string[],
  footerText: string,
  width: number
): string[] {
  const lines: string[] = [];
  lines.push(modalTopRow(title, width));
  lines.push(modalEmptyRow(width));
  for (const line of contentLines) {
    lines.push(modalRow(line, width));
  }
  lines.push(modalEmptyRow(width));
  lines.push(modalDivRow(width));
  lines.push(modalRow(chalk.dim(footerText), width));
  lines.push(modalBotRow(width));
  return lines;
}

// ── Terminal helpers ──────────────────────────────────────────────

function termSize(): { cols: number; rows: number } {
  return {
    cols: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
  };
}

function moveTo(row: number, col: number): string {
  return `\x1B[${row};${col}H`;
}

function hideCursor(): string {
  return "\x1B[?25l";
}

export function showCursor(): string {
  return "\x1B[?25h";
}

export function modalWidth(): number {
  const cols = process.stdout.columns || 80;
  return Math.min(60, cols - 4);
}

// ── Overlay rendering ────────────────────────────────────────────

/**
 * Render dashboard lines dimmed with modal lines overlaid in center.
 */
export function renderOverlay(
  dashboardLines: string[],
  modalLines: string[],
  mWidth: number
): void {
  const { cols, rows } = termSize();

  // Clear screen
  process.stdout.write("\x1B[2J\x1B[0f");
  process.stdout.write(hideCursor());

  // Render dimmed dashboard
  for (let i = 0; i < dashboardLines.length && i < rows; i++) {
    process.stdout.write(
      moveTo(i + 1, 1) + chalk.dim(stripAnsi(dashboardLines[i]))
    );
  }

  // Calculate modal position (centered)
  const startRow = Math.max(1, Math.floor((rows - modalLines.length) / 2));
  const startCol = Math.max(1, Math.floor((cols - mWidth) / 2));

  // Render modal lines at position
  for (let i = 0; i < modalLines.length; i++) {
    process.stdout.write(moveTo(startRow + i, startCol) + modalLines[i]);
  }

  // Move cursor below modal
  process.stdout.write(moveTo(startRow + modalLines.length + 1, 1));
}

// ── Status dialog ────────────────────────────────────────────────

/**
 * Show a brief status message in a modal overlay.
 * Auto-dismisses — caller controls when to re-render dashboard.
 */
export function showStatus(
  title: string,
  message: string,
  dashboardLines: string[]
): void {
  const w = modalWidth();
  const content = [message];
  const footer = "";
  const lines = buildModalFrame(title, content, footer, w);
  renderOverlay(dashboardLines, lines, w);
}

// ── Animated status dialog ──────────────────────────────────────

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_INTERVAL_MS = 80;

export interface SpinnerHandle {
  stop: () => void;
}

/**
 * Show an animated spinner status in a modal overlay.
 * Returns a handle with stop() to stop the animation.
 */
export function showStatusWithSpinner(
  title: string,
  message: string,
  dashboardLines: string[]
): SpinnerHandle {
  const w = modalWidth();
  let frameIndex = 0;
  let stopped = false;

  const render = () => {
    if (stopped) return;
    const spinner = chalk.cyan(SPINNER_FRAMES[frameIndex]);
    const content = [`${spinner} ${message}`];
    const footer = "";
    const lines = buildModalFrame(title, content, footer, w);
    renderOverlay(dashboardLines, lines, w);
    frameIndex = (frameIndex + 1) % SPINNER_FRAMES.length;
  };

  // Initial render
  render();

  // Start animation loop
  const intervalId = setInterval(render, SPINNER_INTERVAL_MS);

  return {
    stop: () => {
      stopped = true;
      clearInterval(intervalId);
    },
  };
}
