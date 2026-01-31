import { describe, expect, it } from "vitest";
import {
  buildModalFrame,
  buildSelectContent,
  buildConfirmContent,
  buildInputContent,
  buildMultilineInputContent,
  modalWidth,
  getVisualLines,
  findCursorVisualPos,
  moveCursorVertical,
  moveCursorHome,
  moveCursorEnd,
  moveCursorWordLeft,
  moveCursorWordRight,
  type SelectEntry,
} from "./modal.js";
import { stripAnsi } from "./display.js";

describe("buildModalFrame", () => {
  it("builds a frame with title, content, and footer", () => {
    const lines = buildModalFrame("Test", ["Hello world"], "Esc Cancel", 40);

    expect(lines.length).toBe(7); // top + empty + content + empty + div + footer + bottom
    // Top row contains title
    expect(stripAnsi(lines[0])).toContain("Test");
    // Content row
    expect(stripAnsi(lines[2])).toContain("Hello world");
    // Footer row
    expect(stripAnsi(lines[5])).toContain("Esc Cancel");
    // Bottom row has closing border
    expect(stripAnsi(lines[6])).toContain("└");
    expect(stripAnsi(lines[6])).toContain("┘");
  });

  it("pads content rows to fill width", () => {
    const lines = buildModalFrame("Title", ["Short"], "", 30);

    // Each line should have consistent visible width
    const widths = lines.map((l) => stripAnsi(l).length);
    // All lines should be the same width (30)
    for (const w of widths) {
      expect(w).toBe(30);
    }
  });

  it("handles multiple content lines", () => {
    const content = ["Line 1", "Line 2", "Line 3"];
    const lines = buildModalFrame("Multi", content, "Footer", 40);

    // top + empty + 3 content + empty + div + footer + bottom = 9
    expect(lines.length).toBe(9);
    expect(stripAnsi(lines[2])).toContain("Line 1");
    expect(stripAnsi(lines[3])).toContain("Line 2");
    expect(stripAnsi(lines[4])).toContain("Line 3");
  });

  it("handles empty content", () => {
    const lines = buildModalFrame("Empty", [], "Footer", 40);
    // top + empty + empty + div + footer + bottom = 6
    expect(lines.length).toBe(6);
  });

  it("truncates content that exceeds modal width", () => {
    const longText = "Pushing ro/feature-64-refactor-command-tuis-to-use-floating-modal-dialogs to remote...";
    const lines = buildModalFrame("Push", [longText], "", 40);

    // Every line should fit within the modal width
    for (const line of lines) {
      expect(stripAnsi(line).length).toBeLessThanOrEqual(40);
    }
    // Content row should end with ellipsis
    expect(stripAnsi(lines[2])).toContain("…");
  });
});

describe("buildSelectContent", () => {
  it("marks the selected item with indicator", () => {
    const items: SelectEntry[] = [
      { name: "Option A", value: "a" },
      { name: "Option B", value: "b" },
      { name: "Option C", value: "c" },
    ];

    const lines = buildSelectContent(items, 1, 50);
    expect(lines.length).toBe(3);

    // Selected item (index 1) should have ">" indicator and bullet
    expect(stripAnsi(lines[1])).toMatch(/^>\s*·\s*Option B/);
    // Non-selected items should not have ">" but should have bullet
    expect(stripAnsi(lines[0])).toMatch(/^\s+·\s*Option A/);
    expect(stripAnsi(lines[2])).toMatch(/^\s+·\s*Option C/);
  });

  it("handles separators without counting them as selectable", () => {
    const items: SelectEntry[] = [
      { separator: "── Group 1 ──" },
      { name: "Option A", value: "a" },
      { separator: "── Group 2 ──" },
      { name: "Option B", value: "b" },
    ];

    const lines = buildSelectContent(items, 0, 50);
    expect(lines.length).toBe(4);

    // First separator
    expect(stripAnsi(lines[0])).toContain("Group 1");
    // First selectable item (index 0) should be selected
    expect(stripAnsi(lines[1])).toMatch(/^>\s*·\s*Option A/);
    // Second separator
    expect(stripAnsi(lines[2])).toContain("Group 2");
    // Second selectable item (index 1) should not be selected
    expect(stripAnsi(lines[3])).toMatch(/^\s+·\s*Option B/);
  });

  it("accepts currentIndex parameter without affecting layout", () => {
    const items: SelectEntry[] = [
      { name: "Option A", value: "a" },
      { name: "Option B", value: "b" },
      { name: "Option C", value: "c" },
    ];

    // Cursor on index 0, current item is index 1
    const lines = buildSelectContent(items, 0, 50, 1);
    expect(lines.length).toBe(3);

    // Current item (index 1) should still show its text without ">"
    expect(stripAnsi(lines[1])).toMatch(/^\s+·\s*Option B/);
    // Selected item (index 0) should still have ">"
    expect(stripAnsi(lines[0])).toMatch(/^>\s*·\s*Option A/);

    // Without currentIndex, layout should be the same
    const linesNoHighlight = buildSelectContent(items, 0, 50);
    expect(stripAnsi(lines[0])).toBe(stripAnsi(linesNoHighlight[0]));
    expect(stripAnsi(lines[1])).toBe(stripAnsi(linesNoHighlight[1]));
  });

  it("truncates long option names", () => {
    const items: SelectEntry[] = [
      { name: "A very long option name that exceeds the maximum width", value: "a" },
    ];

    const lines = buildSelectContent(items, 0, 20);
    expect(stripAnsi(lines[0]).length).toBeLessThanOrEqual(24); // 20 + 4 for prefix (> · )
  });
});

describe("buildConfirmContent", () => {
  it("shows message and Yes/No options", () => {
    const lines = buildConfirmContent("Are you sure?", true);

    expect(lines.length).toBe(4); // message + empty + yes + no
    expect(stripAnsi(lines[0])).toBe("Are you sure?");
    expect(stripAnsi(lines[2])).toContain("Yes");
    expect(stripAnsi(lines[3])).toContain("No");
  });

  it("highlights Yes when selected", () => {
    const lines = buildConfirmContent("Confirm?", true);
    expect(stripAnsi(lines[2])).toMatch(/^>\s*Yes/);
    expect(stripAnsi(lines[3])).toMatch(/^\s+No/);
  });

  it("highlights No when selected", () => {
    const lines = buildConfirmContent("Confirm?", false);
    expect(stripAnsi(lines[2])).toMatch(/^\s+Yes/);
    expect(stripAnsi(lines[3])).toMatch(/^>\s*No/);
  });
});

describe("buildInputContent", () => {
  it("shows label and input value with cursor", () => {
    const lines = buildInputContent("Enter text:", "hello", true);

    expect(lines.length).toBe(3); // label + empty + input
    expect(stripAnsi(lines[0])).toBe("Enter text:");
    expect(stripAnsi(lines[2])).toContain("hello");
  });

  it("shows cursor indicator when visible", () => {
    const linesWithCursor = buildInputContent("Label:", "test", true);
    const linesNoCursor = buildInputContent("Label:", "test", false);

    // Both should contain the value
    expect(stripAnsi(linesWithCursor[2])).toContain("test");
    expect(stripAnsi(linesNoCursor[2])).toContain("test");
  });

  it("handles empty input", () => {
    const lines = buildInputContent("Label:", "", true);
    expect(lines.length).toBe(3);
  });
});

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
    const lastLine = stripAnsi(withCursor[withCursor.length - 1]);
    const firstInputLine = stripAnsi(withCursor[2]);

    // Cursor (_) should only appear on the last line (default cursorPos = end)
    expect(lastLine).toContain("_");
    expect(firstInputLine).not.toContain("_");
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
  it("places cursor at specified position", () => {
    const lines = buildMultilineInputContent("Label:", "hello", true, 40, 2);
    const inputLine = stripAnsi(lines[2]);
    // Cursor (_) should be between 'he' and 'llo'
    expect(inputLine).toContain("he_llo");
  });

  it("places cursor at start of text", () => {
    const lines = buildMultilineInputContent("Label:", "hello", true, 40, 0);
    const inputLine = stripAnsi(lines[2]);
    expect(inputLine).toContain("_hello");
  });

  it("places cursor at end of text (default)", () => {
    const lines = buildMultilineInputContent("Label:", "hello", true, 40);
    const inputLine = stripAnsi(lines[2]);
    expect(inputLine).toContain("hello_");
  });

  it("places cursor on correct line in multiline text", () => {
    const lines = buildMultilineInputContent("Label:", "ab\ncd", true, 40, 4);
    // Cursor at offset 4 = col 1 on second line ("cd")
    expect(stripAnsi(lines[2])).not.toContain("_");
    expect(stripAnsi(lines[3])).toContain("c_d");
  });

  it("renders cursor on empty input", () => {
    const lines = buildMultilineInputContent("Label:", "", true, 40, 0);
    expect(lines.length).toBe(3);
    expect(stripAnsi(lines[2])).toContain("_");
  });
});

describe("modalWidth", () => {
  it("returns a positive number", () => {
    const w = modalWidth();
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThanOrEqual(60);
  });
});
