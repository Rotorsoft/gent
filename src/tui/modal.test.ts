import { describe, expect, it } from "vitest";
import { buildModalFrame, modalWidth } from "./modal.js";
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

describe("modalWidth", () => {
  it("returns a positive number", () => {
    const w = modalWidth();
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThanOrEqual(60);
  });
});
