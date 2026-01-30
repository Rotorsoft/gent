import { describe, expect, it } from "vitest";
import {
  buildModalFrame,
  buildSelectContent,
  buildConfirmContent,
  buildInputContent,
  modalWidth,
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

    // Selected item (index 1) should have ">" indicator
    expect(stripAnsi(lines[1])).toMatch(/^>\s*Option B/);
    // Non-selected items should not have ">"
    expect(stripAnsi(lines[0])).toMatch(/^\s+Option A/);
    expect(stripAnsi(lines[2])).toMatch(/^\s+Option C/);
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
    expect(stripAnsi(lines[1])).toMatch(/^>\s*Option A/);
    // Second separator
    expect(stripAnsi(lines[2])).toContain("Group 2");
    // Second selectable item (index 1) should not be selected
    expect(stripAnsi(lines[3])).toMatch(/^\s+Option B/);
  });

  it("truncates long option names", () => {
    const items: SelectEntry[] = [
      { name: "A very long option name that exceeds the maximum width", value: "a" },
    ];

    const lines = buildSelectContent(items, 0, 20);
    expect(stripAnsi(lines[0]).length).toBeLessThanOrEqual(22); // 20 + 2 for prefix
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

describe("modalWidth", () => {
  it("returns a positive number", () => {
    const w = modalWidth();
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThanOrEqual(60);
  });
});
