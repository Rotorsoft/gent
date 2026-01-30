import chalk from "chalk";
import { stripAnsi, visibleLen, truncateAnsi } from "./display.js";

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

// ── Content builders (pure, testable) ─────────────────────────────

export interface SelectItem {
  name: string;
  value: string;
}

export interface SelectSeparator {
  separator: string;
}

export type SelectEntry = SelectItem | SelectSeparator;

function isSeparator(entry: SelectEntry): entry is SelectSeparator {
  return "separator" in entry;
}

export function buildSelectContent(
  items: SelectEntry[],
  selectedIndex: number,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  let selectableIdx = 0;

  for (const item of items) {
    if (isSeparator(item)) {
      lines.push(chalk.dim(item.separator));
    } else {
      const isSelected = selectableIdx === selectedIndex;
      const prefix = isSelected ? chalk.cyan.bold("> ") : "  ";
      const bullet = isSelected ? chalk.cyan("· ") : chalk.dim("· ");
      const label = truncateAnsi(item.name, maxWidth - 4);
      lines.push(
        prefix + bullet + (isSelected ? chalk.cyan.inverse(label) : label)
      );
      selectableIdx++;
    }
  }

  return lines;
}

export function buildConfirmContent(
  message: string,
  selectedYes: boolean
): string[] {
  const yes = selectedYes
    ? chalk.cyan.bold("> Yes")
    : chalk.dim("  Yes");
  const no = !selectedYes
    ? chalk.cyan.bold("> No")
    : chalk.dim("  No");
  return [message, "", yes, no];
}

export function buildInputContent(
  label: string,
  value: string,
  cursorVisible: boolean
): string[] {
  const cursor = cursorVisible ? chalk.cyan("_") : " ";
  return [label, "", chalk.cyan("> ") + value + cursor];
}

/**
 * Build multiline input content with word wrapping.
 * Each line of text is wrapped to fit within maxWidth, prefixed with "> " on line 1.
 */
export function buildMultilineInputContent(
  label: string,
  value: string,
  cursorVisible: boolean,
  maxWidth: number
): string[] {
  const cursor = cursorVisible ? chalk.cyan("_") : " ";
  const lines: string[] = [label, ""];

  if (value === "") {
    // Empty input: show just the cursor
    lines.push(chalk.cyan("  ") + cursor);
  } else {
    // Split value by newlines, then wrap each logical line
    const inputLines = value.split("\n");
    const contentWidth = maxWidth - 2; // account for prefix space

    for (let i = 0; i < inputLines.length; i++) {
      const raw = inputLines[i];
      const wrapped = wrapLine(raw, contentWidth);
      for (let j = 0; j < wrapped.length; j++) {
        const isLastLine = i === inputLines.length - 1 && j === wrapped.length - 1;
        const text = wrapped[j] + (isLastLine ? cursor : "");
        lines.push(chalk.cyan("  ") + text);
      }
    }
  }

  return lines;
}

function wrapLine(text: string, width: number): string[] {
  if (width <= 0) return [text];
  if (text.length <= width) return [text];

  const result: string[] = [];
  let remaining = text;
  while (remaining.length > width) {
    // Find last space within width
    let breakAt = remaining.lastIndexOf(" ", width);
    if (breakAt <= 0) breakAt = width; // force break if no space
    result.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt).replace(/^ /, ""); // trim leading space
  }
  if (remaining.length > 0 || result.length === 0) {
    result.push(remaining);
  }
  return result;
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

function showCursor(): string {
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

// ── Key reading ──────────────────────────────────────────────────

export interface KeyPress {
  name: string;
  raw: string;
}

export function readKey(): Promise<KeyPress> {
  return new Promise((resolve) => {
    const { stdin } = process;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const onData = (data: string) => {
      stdin.setRawMode(wasRaw ?? false);
      stdin.pause();
      stdin.removeListener("data", onData);

      if (data === "\x03") {
        resolve({ name: "escape", raw: data }); // Ctrl+C → escape
      } else if (data === "\x1b" || data === "\x1b\x1b") {
        resolve({ name: "escape", raw: data });
      } else if (data === "\x1b[A") {
        resolve({ name: "up", raw: data });
      } else if (data === "\x1b[B") {
        resolve({ name: "down", raw: data });
      } else if (data === "\x1b[C") {
        resolve({ name: "right", raw: data });
      } else if (data === "\x1b[D") {
        resolve({ name: "left", raw: data });
      } else if (data === "\r" || data === "\n") {
        resolve({ name: "enter", raw: data });
      } else if (data === "\x7f" || data === "\x08") {
        resolve({ name: "backspace", raw: data });
      } else if (data === "\t") {
        resolve({ name: "tab", raw: data });
      } else if (data === "\x13") {
        resolve({ name: "ctrl-s", raw: data }); // Ctrl+S
      } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
        resolve({ name: data, raw: data });
      } else {
        // Unknown sequence — treat as no-op, read again
        stdin.setRawMode(true);
        stdin.resume();
        stdin.on("data", onData);
      }
    };

    stdin.on("data", onData);
  });
}

// ── Modal dialogs ────────────────────────────────────────────────

export interface ConfirmOptions {
  title: string;
  message: string;
  dashboardLines: string[];
}

/**
 * Show a confirm dialog overlaying the dashboard.
 * Returns true for yes, false for no/cancel.
 */
export async function showConfirm(opts: ConfirmOptions): Promise<boolean> {
  const w = modalWidth();
  let selectedYes = true;

  const render = () => {
    const content = buildConfirmContent(opts.message, selectedYes);
    const footer = "↑↓ Select  Enter Confirm  Esc Cancel";
    const lines = buildModalFrame(opts.title, content, footer, w);
    renderOverlay(opts.dashboardLines, lines, w);
  };

  render();

  while (true) {
    const key = await readKey();

    switch (key.name) {
      case "up":
      case "down":
      case "tab":
        selectedYes = !selectedYes;
        render();
        break;

      case "enter":
        process.stdout.write(showCursor());
        return selectedYes;

      case "escape":
        process.stdout.write(showCursor());
        return false;

      case "y":
        process.stdout.write(showCursor());
        return true;

      case "n":
        process.stdout.write(showCursor());
        return false;
    }
  }
}

export interface SelectOptions {
  title: string;
  items: SelectEntry[];
  dashboardLines: string[];
}

/**
 * Get the selectable items count (excluding separators).
 */
function selectableCount(items: SelectEntry[]): number {
  return items.filter((i) => !isSeparator(i)).length;
}

/**
 * Show a select dialog overlaying the dashboard.
 * Returns the selected value or null if cancelled.
 */
export async function showSelect(opts: SelectOptions): Promise<string | null> {
  const w = modalWidth();
  const maxItems = selectableCount(opts.items);
  if (maxItems === 0) return null;

  let selectedIndex = 0;

  const render = () => {
    const content = buildSelectContent(opts.items, selectedIndex, w - 6);
    const footer = "↑↓ Navigate  Enter Select  Esc Cancel";
    const lines = buildModalFrame(opts.title, content, footer, w);
    renderOverlay(opts.dashboardLines, lines, w);
  };

  render();

  while (true) {
    const key = await readKey();

    switch (key.name) {
      case "up":
        selectedIndex = (selectedIndex - 1 + maxItems) % maxItems;
        render();
        break;

      case "down":
        selectedIndex = (selectedIndex + 1) % maxItems;
        render();
        break;

      case "enter": {
        process.stdout.write(showCursor());
        // Find the nth selectable item
        let idx = 0;
        for (const item of opts.items) {
          if (!isSeparator(item)) {
            if (idx === selectedIndex) return item.value;
            idx++;
          }
        }
        return null;
      }

      case "escape":
        process.stdout.write(showCursor());
        return null;
    }
  }
}

export interface InputOptions {
  title: string;
  label: string;
  dashboardLines: string[];
}

/**
 * Show a text input dialog overlaying the dashboard.
 * Returns the entered text or null if cancelled.
 */
export async function showInput(opts: InputOptions): Promise<string | null> {
  const w = modalWidth();
  let value = "";
  let cursorBlink = true;

  const render = () => {
    const maxLen = w - 10;
    const displayValue = value.length > maxLen
      ? value.slice(value.length - maxLen)
      : value;
    const content = buildInputContent(opts.label, displayValue, cursorBlink);
    const footer = "Enter Submit  Esc Cancel";
    const lines = buildModalFrame(opts.title, content, footer, w);
    renderOverlay(opts.dashboardLines, lines, w);
  };

  render();

  while (true) {
    const key = await readKey();

    switch (key.name) {
      case "enter":
        process.stdout.write(showCursor());
        return value.trim() || null;

      case "escape":
        process.stdout.write(showCursor());
        return null;

      case "backspace":
        if (value.length > 0) {
          value = value.slice(0, -1);
        }
        render();
        break;

      default:
        // Single printable character
        if (key.raw.length === 1 && key.raw.charCodeAt(0) >= 32) {
          value += key.raw;
          cursorBlink = true;
          render();
        }
        break;
    }
  }
}

/**
 * Show a multiline text input dialog overlaying the dashboard.
 * Enter inserts a newline; Ctrl+S submits.
 * Returns the entered text or null if cancelled.
 */
export async function showMultilineInput(
  opts: InputOptions
): Promise<string | null> {
  const w = modalWidth();
  let value = "";
  let cursorBlink = true;
  const contentWidth = w - 6; // inner width minus borders and padding

  const render = () => {
    const content = buildMultilineInputContent(
      opts.label,
      value,
      cursorBlink,
      contentWidth
    );
    const footer = "Enter Newline  Ctrl+S Submit  Esc Cancel";
    const lines = buildModalFrame(opts.title, content, footer, w);
    renderOverlay(opts.dashboardLines, lines, w);
  };

  render();

  while (true) {
    const key = await readKey();

    switch (key.name) {
      case "ctrl-s":
        process.stdout.write(showCursor());
        return value.trim() || null;

      case "enter":
        value += "\n";
        cursorBlink = true;
        render();
        break;

      case "escape":
        process.stdout.write(showCursor());
        return null;

      case "backspace":
        if (value.length > 0) {
          value = value.slice(0, -1);
        }
        render();
        break;

      default:
        if (key.raw.length === 1 && key.raw.charCodeAt(0) >= 32) {
          value += key.raw;
          cursorBlink = true;
          render();
        }
        break;
    }
  }
}

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
