import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "./logger";

describe("logger.box", () => {
  let consoleOutput: string[];

  beforeEach(() => {
    consoleOutput = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      consoleOutput.push(args.join(" "));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to strip ANSI codes for easier testing
  // eslint-disable-next-line no-control-regex
  const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, "");

  it("should align borders correctly with simple content", () => {
    logger.box("Title", "Content line");

    const stripped = consoleOutput.map(stripAnsi);

    // All lines should have the same length
    const lengths = stripped.map((line) => line.length);
    expect(new Set(lengths).size).toBe(1);

    // Check border alignment
    expect(stripped[0]).toMatch(/^┌─+┐$/);
    expect(stripped[1]).toMatch(/^│ .+ │$/);
    expect(stripped[2]).toMatch(/^├─+┤$/);
    expect(stripped[3]).toMatch(/^│ .+ │$/);
    expect(stripped[4]).toMatch(/^└─+┘$/);
  });

  it("should align borders with multiline content", () => {
    logger.box("Title", "Short\nMedium line\nA longer content line");

    const stripped = consoleOutput.map(stripAnsi);

    // All lines should have the same length
    const lengths = stripped.map((line) => line.length);
    expect(new Set(lengths).size).toBe(1);
  });

  it("should align borders with empty content", () => {
    logger.box("Title", "");

    const stripped = consoleOutput.map(stripAnsi);

    // All lines should have the same length
    const lengths = stripped.map((line) => line.length);
    expect(new Set(lengths).size).toBe(1);
  });

  it("should align borders when title is longer than content", () => {
    logger.box("A Very Long Title Here", "Short");

    const stripped = consoleOutput.map(stripAnsi);

    // All lines should have the same length
    const lengths = stripped.map((line) => line.length);
    expect(new Set(lengths).size).toBe(1);
  });

  it("should align borders with content containing ANSI codes", () => {
    // Simulate colored content
    const coloredContent = "\x1b[32mGreen text\x1b[0m";
    logger.box("Title", coloredContent);

    const stripped = consoleOutput.map(stripAnsi);

    // All lines should have the same length
    const lengths = stripped.map((line) => line.length);
    expect(new Set(lengths).size).toBe(1);
  });

  it("should handle mixed colored and plain content", () => {
    const content = "Plain line\n\x1b[31mRed line\x1b[0m\nAnother plain";
    logger.box("Test", content);

    const stripped = consoleOutput.map(stripAnsi);

    // All lines should have the same length
    const lengths = stripped.map((line) => line.length);
    expect(new Set(lengths).size).toBe(1);
  });
});
