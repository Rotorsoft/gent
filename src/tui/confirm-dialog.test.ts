import { describe, expect, it } from "vitest";
import { buildConfirmContent } from "./confirm-dialog.js";
import { stripAnsi } from "./display.js";

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
