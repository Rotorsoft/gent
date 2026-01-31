import { describe, expect, it } from "vitest";
import {
  buildMultilineInputContent,
  getVisualLines,
  findCursorVisualPos,
  moveCursorVertical,
  moveCursorHome,
  moveCursorEnd,
  moveCursorWordLeft,
  moveCursorWordRight,
} from "./multiline-input.js";
import { stripAnsi } from "./display.js";

describe("buildMultilineInputContent", () => {
  it("shows label and single-line input with cursor", () => {
    const lines = buildMultilineInputContent("Describe:", "hello", true, 40);

    expect(stripAnsi(lines[0])).toBe("Describe:");
    expect(stripAnsi(lines[1])).toBe(""); // blank separator
    expect(stripAnsi(lines[2])).toContain("hello");
  });

  it("renders multiple lines for newline-separated input", () => {
    const lines = buildMultilineInputContent("Describe:", "line1\nline2\nline3", true, 40);

    // label + blank + 3 input lines = 5
    expect(lines.length).toBe(5);
    expect(stripAnsi(lines[2])).toContain("line1");
    expect(stripAnsi(lines[3])).toContain("line2");
    expect(stripAnsi(lines[4])).toContain("line3");
  });

  it("wraps long lines within maxWidth", () => {
    const longText = "This is a very long line that should be wrapped at word boundaries";
    const lines = buildMultilineInputContent("Label:", longText, true, 20);

    // Should produce multiple wrapped lines
    expect(lines.length).toBeGreaterThan(3); // label + blank + multiple wrapped lines
  });

  it("handles empty input showing just cursor", () => {
    const lines = buildMultilineInputContent("Label:", "", true, 40);

    expect(lines.length).toBe(3); // label + blank + cursor line
  });

  it("places cursor at end of last line by default", () => {
    const withCursor = buildMultilineInputContent("Label:", "a\nb", true, 40);

    // Text content should be preserved without extra characters
    expect(stripAnsi(withCursor[2])).toContain("a");
    expect(stripAnsi(withCursor[3])).toContain("b");
    // Cursor at end adds an inverse space — visible as trailing space
    expect(stripAnsi(withCursor[3])).toMatch(/b\s/);
  });
});

describe("getVisualLines", () => {
  it("returns one line for short text", () => {
    const lines = getVisualLines("hello", 40);
    expect(lines).toEqual([{ text: "hello", globalOffset: 0, length: 5 }]);
  });

  it("splits on newlines", () => {
    const lines = getVisualLines("a\nb\nc", 40);
    expect(lines).toEqual([
      { text: "a", globalOffset: 0, length: 1 },
      { text: "b", globalOffset: 2, length: 1 },
      { text: "c", globalOffset: 4, length: 1 },
    ]);
  });

  it("wraps long lines", () => {
    const lines = getVisualLines("hello world", 8);
    expect(lines.length).toBe(2);
    expect(lines[0]).toEqual({ text: "hello", globalOffset: 0, length: 5 });
    expect(lines[1]).toEqual({ text: "world", globalOffset: 6, length: 5 });
  });

  it("handles empty string", () => {
    const lines = getVisualLines("", 40);
    expect(lines).toEqual([{ text: "", globalOffset: 0, length: 0 }]);
  });

  it("handles trailing newline", () => {
    const lines = getVisualLines("hello\n", 40);
    expect(lines.length).toBe(2);
    expect(lines[0]).toEqual({ text: "hello", globalOffset: 0, length: 5 });
    expect(lines[1]).toEqual({ text: "", globalOffset: 6, length: 0 });
  });
});

describe("findCursorVisualPos", () => {
  it("finds cursor at start", () => {
    const lines = getVisualLines("hello", 40);
    expect(findCursorVisualPos(lines, 0)).toEqual({ row: 0, col: 0 });
  });

  it("finds cursor at end", () => {
    const lines = getVisualLines("hello", 40);
    expect(findCursorVisualPos(lines, 5)).toEqual({ row: 0, col: 5 });
  });

  it("finds cursor on second line after newline", () => {
    const lines = getVisualLines("ab\ncd", 40);
    expect(findCursorVisualPos(lines, 3)).toEqual({ row: 1, col: 0 });
    expect(findCursorVisualPos(lines, 4)).toEqual({ row: 1, col: 1 });
  });

  it("finds cursor on wrapped line", () => {
    const lines = getVisualLines("hello world", 8);
    // "hello" (0-4), "world" (6-10)
    expect(findCursorVisualPos(lines, 6)).toEqual({ row: 1, col: 0 });
    expect(findCursorVisualPos(lines, 8)).toEqual({ row: 1, col: 2 });
  });
});

describe("moveCursorVertical", () => {
  it("moves down to next line", () => {
    const pos = moveCursorVertical("ab\ncd", 1, 40, 1);
    expect(pos).toBe(4); // col 1 on second line → offset 3+1=4
  });

  it("moves up to previous line", () => {
    const pos = moveCursorVertical("ab\ncd", 4, 40, -1);
    expect(pos).toBe(1); // col 1 on first line
  });

  it("clamps column when target line is shorter", () => {
    const pos = moveCursorVertical("abcde\nxy", 4, 40, 1);
    expect(pos).toBe(8); // col 4 → clamped to col 2 on "xy" → offset 6+2=8
  });

  it("does nothing when at top and moving up", () => {
    const pos = moveCursorVertical("ab\ncd", 1, 40, -1);
    expect(pos).toBe(1);
  });

  it("does nothing when at bottom and moving down", () => {
    const pos = moveCursorVertical("ab\ncd", 4, 40, 1);
    expect(pos).toBe(4);
  });

  it("works across wrapped lines", () => {
    // "hello world" wraps to "hello" + "world" at width 8
    const pos = moveCursorVertical("hello world", 2, 8, 1);
    // col 2 on "hello" → col 2 on "world" → offset 6+2=8
    expect(pos).toBe(8);
  });
});

describe("moveCursorHome", () => {
  it("moves to start of current line", () => {
    expect(moveCursorHome("ab\ncd", 4, 40)).toBe(3);
  });

  it("stays at start if already there", () => {
    expect(moveCursorHome("ab\ncd", 0, 40)).toBe(0);
  });
});

describe("moveCursorEnd", () => {
  it("moves to end of current line", () => {
    expect(moveCursorEnd("ab\ncd", 3, 40)).toBe(5);
  });

  it("stays at end if already there", () => {
    expect(moveCursorEnd("ab\ncd", 2, 40)).toBe(2);
  });
});

describe("moveCursorWordLeft", () => {
  it("jumps to start of current word", () => {
    expect(moveCursorWordLeft("hello world", 8)).toBe(6);
  });

  it("jumps past spaces to previous word", () => {
    expect(moveCursorWordLeft("hello world", 6)).toBe(0);
  });

  it("returns 0 at start", () => {
    expect(moveCursorWordLeft("hello", 0)).toBe(0);
  });
});

describe("moveCursorWordRight", () => {
  it("jumps to start of next word", () => {
    expect(moveCursorWordRight("hello world", 0)).toBe(6);
  });

  it("returns length at end", () => {
    expect(moveCursorWordRight("hello", 5)).toBe(5);
  });
});

describe("buildMultilineInputContent with cursorPos", () => {
  it("does not insert extra characters at cursor position", () => {
    const lines = buildMultilineInputContent("Label:", "hello", true, 40, 2);
    const inputLine = stripAnsi(lines[2]);
    // Text should be preserved without extra chars (no inserted underscore)
    expect(inputLine).toContain("hello");
  });

  it("preserves text at cursor start", () => {
    const lines = buildMultilineInputContent("Label:", "hello", true, 40, 0);
    expect(stripAnsi(lines[2])).toContain("hello");
  });

  it("preserves text at cursor end (default)", () => {
    const lines = buildMultilineInputContent("Label:", "hello", true, 40);
    expect(stripAnsi(lines[2])).toContain("hello");
  });

  it("places cursor on correct line in multiline text", () => {
    const lines = buildMultilineInputContent("Label:", "ab\ncd", true, 40, 4);
    // Both lines should have their text preserved
    expect(stripAnsi(lines[2])).toContain("ab");
    expect(stripAnsi(lines[3])).toContain("cd");
  });

  it("renders cursor on empty input", () => {
    const lines = buildMultilineInputContent("Label:", "", true, 40, 0);
    expect(lines.length).toBe(3);
    // Cursor renders as inverse space on empty line
    expect(stripAnsi(lines[2]).trim()).toBe("");
  });
});
