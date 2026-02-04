import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, type TableEntry } from "./logger";

// Helper to strip ANSI codes for easier testing
// eslint-disable-next-line no-control-regex
const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, "");

describe("logger.table", () => {
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

  it("should render a table with key-value pairs", () => {
    const entries: TableEntry[] = [
      { key: "Branch", value: "feature-123" },
      { key: "Base", value: "main" },
    ];
    logger.table("Summary", entries);

    const stripped = consoleOutput.map(stripAnsi);

    // All lines should have the same length
    const lengths = stripped.map((line) => line.length);
    expect(new Set(lengths).size).toBe(1);

    // Check structure
    expect(stripped[0]).toMatch(/^┌─+┐$/);
    expect(stripped[1]).toMatch(/^│ Summary\s+│$/);
    expect(stripped[2]).toMatch(/^├─+┤$/);
    expect(stripped[3]).toContain("Branch");
    expect(stripped[3]).toContain("feature-123");
    expect(stripped[4]).toContain("Base");
    expect(stripped[4]).toContain("main");
    expect(stripped[5]).toMatch(/^└─+┘$/);
  });

  it("should filter out entries with empty values", () => {
    const entries: TableEntry[] = [
      { key: "Present", value: "yes" },
      { key: "Empty", value: "" },
      { key: "Also Present", value: "yes" },
    ];
    logger.table("Test", entries);

    const stripped = consoleOutput.map(stripAnsi);
    const content = stripped.join("\n");

    expect(content).toContain("Present");
    expect(content).not.toContain("Empty");
    expect(content).toContain("Also Present");
  });

  it("should not render anything if all entries are empty", () => {
    const entries: TableEntry[] = [
      { key: "Empty1", value: "" },
      { key: "Empty2", value: "" },
    ];
    logger.table("Test", entries);

    expect(consoleOutput).toHaveLength(0);
  });

  it("should handle content with ANSI codes", () => {
    const entries: TableEntry[] = [
      { key: "Colored", value: "\x1b[32mgreen\x1b[0m" },
      { key: "Plain", value: "text" },
    ];
    logger.table("Test", entries);

    const stripped = consoleOutput.map(stripAnsi);

    // All lines should have the same length
    const lengths = stripped.map((line) => line.length);
    expect(new Set(lengths).size).toBe(1);
  });

  it("should align keys correctly with varying lengths", () => {
    const entries: TableEntry[] = [
      { key: "A", value: "short" },
      { key: "Longer Key", value: "value" },
      { key: "B", value: "another" },
    ];
    logger.table("Test", entries);

    const stripped = consoleOutput.map(stripAnsi);

    // All lines should have the same length
    const lengths = stripped.map((line) => line.length);
    expect(new Set(lengths).size).toBe(1);
  });

  it("should handle long title correctly", () => {
    const entries: TableEntry[] = [{ key: "K", value: "v" }];
    logger.table("A Very Long Title That Exceeds Content", entries);

    const stripped = consoleOutput.map(stripAnsi);

    // All lines should have the same length
    const lengths = stripped.map((line) => line.length);
    expect(new Set(lengths).size).toBe(1);

    expect(stripped[1]).toContain("A Very Long Title That Exceeds Content");
  });
});

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
