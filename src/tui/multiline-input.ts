import chalk from "chalk";
import { readKey } from "./key-reader.js";
import { type InputOptions } from "./input-dialog.js";
import { buildModalFrame, renderOverlay, modalWidth, showCursor } from "./modal.js";

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

// ── Content builder (pure, testable) ─────────────────────────────

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
  const lines: string[] = [label, ""];
  const contentWidth = maxWidth - 2;

  const visualLines = getVisualLines(value, contentWidth);
  const { row: cursorRow, col: cursorCol } = findCursorVisualPos(visualLines, cp);

  for (let i = 0; i < visualLines.length; i++) {
    const text = visualLines[i].text;
    if (i === cursorRow && cursorVisible) {
      const charUnderCursor = cursorCol < text.length ? text[cursorCol] : " ";
      lines.push(
        chalk.cyan("  ") +
          text.slice(0, cursorCol) +
          chalk.inverse(charUnderCursor) +
          text.slice(cursorCol + 1)
      );
    } else {
      lines.push(chalk.cyan("  ") + text);
    }
  }

  return lines;
}

// ── Multiline input dialog ───────────────────────────────────────

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
