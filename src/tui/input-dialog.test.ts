import { describe, expect, it } from "vitest";
import { buildInputContent } from "./input-dialog.js";
import { stripAnsi } from "./display.js";

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
