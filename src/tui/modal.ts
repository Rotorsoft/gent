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
  maxWidth: number,
  currentIndex?: number
): string[] {
  const lines: string[] = [];
  let selectableIdx = 0;

  for (const item of items) {
    if (isSeparator(item)) {
      lines.push(chalk.dim(item.separator));
    } else {
      const isSelected = selectableIdx === selectedIndex;
      const isCurrent = currentIndex != null && selectableIdx === currentIndex;
      const prefix = isSelected ? chalk.cyan.bold("> ") : "  ";
      const bullet = chalk.dim("· ");
      const label = truncateAnsi(item.name, maxWidth - 4);
      const styledLabel = isSelected
        ? chalk.bold(label)
        : isCurrent
          ? chalk.cyan(label)
          : label;
      lines.push(prefix + bullet + styledLabel);
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
 * Cursor is rendered at cursorPos (defaults to end of text).
 */
export function buildMultilineInputContent(
  label: string,
  value: string,
  cursorVisible: boolean,
  maxWidth: number,
  cursorPos?: number
): string[] {
  const cp = cursorPos ?? value.length;
  const cursor = cursorVisible ? chalk.cyan("_") : " ";
  const lines: string[] = [label, ""];
  const contentWidth = maxWidth - 2;

  const visualLines = getVisualLines(value, contentWidth);
  const { row: cursorRow, col: cursorCol } = findCursorVisualPos(visualLines, cp);

  for (let i = 0; i < visualLines.length; i++) {
    const text = visualLines[i].text;
    if (i === cursorRow) {
      lines.push(
        chalk.cyan("  ") +
          text.slice(0, cursorCol) +
          cursor +
          text.slice(cursorCol)
      );
    } else {
      lines.push(chalk.cyan("  ") + text);
    }
  }

  return lines;
}

// ── Visual line mapping for cursor positioning ──────────────────

interface WrapSegment {
  text: string;
  offset: number; // start offset within the logical line
}

function wrapLineWithMap(text: string, width: number): WrapSegment[] {
  if (width <= 0) return [{ text, offset: 0 }];
  if (text.length <= width) return [{ text, offset: 0 }];

  const result: WrapSegment[] = [];
  let pos = 0;
  let remaining = text;
  while (remaining.length > width) {
    let breakAt = remaining.lastIndexOf(" ", width);
    if (breakAt <= 0) breakAt = width;
    result.push({ text: remaining.slice(0, breakAt), offset: pos });
    pos += breakAt;
    remaining = remaining.slice(breakAt);
    if (remaining.startsWith(" ")) {
      remaining = remaining.slice(1);
      pos += 1;
    }
  }
  if (remaining.length > 0 || result.length === 0) {
    result.push({ text: remaining, offset: pos });
  }
  return result;
}

export interface VisualLine {
  text: string;
  globalOffset: number; // offset in the full value string
  length: number;
}

export function getVisualLines(value: string, contentWidth: number): VisualLine[] {
  const inputLines = value.split("\n");
  const result: VisualLine[] = [];
  let globalPos = 0;

  for (let i = 0; i < inputLines.length; i++) {
    const raw = inputLines[i];
    const wrapped = wrapLineWithMap(raw, contentWidth);
    for (const seg of wrapped) {
      result.push({
        text: seg.text,
        globalOffset: globalPos + seg.offset,
        length: seg.text.length,
      });
    }
    globalPos += raw.length + 1; // +1 for the newline
  }

  return result;
}

export function findCursorVisualPos(
  visualLines: VisualLine[],
  cursorPos: number
): { row: number; col: number } {
  for (let i = 0; i < visualLines.length; i++) {
    const vl = visualLines[i];
    if (cursorPos >= vl.globalOffset && cursorPos <= vl.globalOffset + vl.length) {
      return { row: i, col: cursorPos - vl.globalOffset };
    }
  }
  const last = visualLines[visualLines.length - 1];
  return { row: visualLines.length - 1, col: last.length };
}

// ── Cursor movement helpers (pure, testable) ────────────────────

export function moveCursorVertical(
  value: string,
  cursorPos: number,
  contentWidth: number,
  direction: -1 | 1
): number {
  const visualLines = getVisualLines(value, contentWidth);
  const { row, col } = findCursorVisualPos(visualLines, cursorPos);
  const newRow = row + direction;
  if (newRow < 0 || newRow >= visualLines.length) return cursorPos;
  const targetLine = visualLines[newRow];
  const newCol = Math.min(col, targetLine.length);
  return targetLine.globalOffset + newCol;
}

export function moveCursorHome(
  value: string,
  cursorPos: number,
  contentWidth: number
): number {
  const visualLines = getVisualLines(value, contentWidth);
  const { row } = findCursorVisualPos(visualLines, cursorPos);
  return visualLines[row].globalOffset;
}

export function moveCursorEnd(
  value: string,
  cursorPos: number,
  contentWidth: number
): number {
  const visualLines = getVisualLines(value, contentWidth);
  const { row } = findCursorVisualPos(visualLines, cursorPos);
  return visualLines[row].globalOffset + visualLines[row].length;
}

export function moveCursorWordLeft(value: string, cursorPos: number): number {
  if (cursorPos <= 0) return 0;
  let pos = cursorPos - 1;
  // Skip non-word chars
  while (pos > 0 && !/\w/.test(value[pos])) pos--;
  // Skip word chars
  while (pos > 0 && /\w/.test(value[pos - 1])) pos--;
  return pos;
}

export function moveCursorWordRight(value: string, cursorPos: number): number {
  if (cursorPos >= value.length) return value.length;
  let pos = cursorPos;
  // Skip word chars
  while (pos < value.length && /\w/.test(value[pos])) pos++;
  // Skip non-word chars
  while (pos < value.length && !/\w/.test(value[pos])) pos++;
  return pos;
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
      } else if (data === "\x1b[1;5C" || data === "\x1b[5C") {
        resolve({ name: "ctrl-right", raw: data });
      } else if (data === "\x1b[1;5D" || data === "\x1b[5D") {
        resolve({ name: "ctrl-left", raw: data });
      } else if (data === "\x1b[3~") {
        resolve({ name: "delete", raw: data });
      } else if (data === "\x1b[H" || data === "\x1b[1~") {
        resolve({ name: "home", raw: data });
      } else if (data === "\x1b[F" || data === "\x1b[4~") {
        resolve({ name: "end", raw: data });
      } else if (data === "\x01") {
        resolve({ name: "home", raw: data }); // Ctrl+A
      } else if (data === "\x05") {
        resolve({ name: "end", raw: data }); // Ctrl+E
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
  initialIndex?: number;
  currentIndex?: number;
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

  let selectedIndex = opts.initialIndex ?? 0;

  const render = () => {
    const content = buildSelectContent(opts.items, selectedIndex, w - 6, opts.currentIndex);
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
  let cursorPos = 0;
  let cursorBlink = true;
  const contentWidth = w - 6; // inner width minus borders and padding

  const render = () => {
    const content = buildMultilineInputContent(
      opts.label,
      value,
      cursorBlink,
      contentWidth,
      cursorPos
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
        value = value.slice(0, cursorPos) + "\n" + value.slice(cursorPos);
        cursorPos++;
        cursorBlink = true;
        render();
        break;

      case "escape":
        process.stdout.write(showCursor());
        return null;

      case "backspace":
        if (cursorPos > 0) {
          value = value.slice(0, cursorPos - 1) + value.slice(cursorPos);
          cursorPos--;
        }
        render();
        break;

      case "delete":
        if (cursorPos < value.length) {
          value = value.slice(0, cursorPos) + value.slice(cursorPos + 1);
        }
        render();
        break;

      case "left":
        if (cursorPos > 0) cursorPos--;
        render();
        break;

      case "right":
        if (cursorPos < value.length) cursorPos++;
        render();
        break;

      case "up":
        cursorPos = moveCursorVertical(value, cursorPos, contentWidth - 2, -1);
        render();
        break;

      case "down":
        cursorPos = moveCursorVertical(value, cursorPos, contentWidth - 2, 1);
        render();
        break;

      case "home":
        cursorPos = moveCursorHome(value, cursorPos, contentWidth - 2);
        render();
        break;

      case "end":
        cursorPos = moveCursorEnd(value, cursorPos, contentWidth - 2);
        render();
        break;

      case "ctrl-left":
        cursorPos = moveCursorWordLeft(value, cursorPos);
        render();
        break;

      case "ctrl-right":
        cursorPos = moveCursorWordRight(value, cursorPos);
        render();
        break;

      default:
        if (key.raw.length === 1 && key.raw.charCodeAt(0) >= 32) {
          value = value.slice(0, cursorPos) + key.raw + value.slice(cursorPos);
          cursorPos++;
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
