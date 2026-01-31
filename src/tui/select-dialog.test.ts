import { describe, expect, it } from "vitest";
import { buildSelectContent, type SelectEntry } from "./select-dialog.js";
import { stripAnsi } from "./display.js";

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
