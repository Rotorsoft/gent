import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { buildModalFrame, modalWidth, showStatusWithSpinner } from "./modal.js";
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

describe("showStatusWithSpinner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock stdout.write to avoid polluting test output
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns a handle with stop function", () => {
    const handle = showStatusWithSpinner("Test", "Loading...", []);
    expect(handle).toHaveProperty("stop");
    expect(typeof handle.stop).toBe("function");
    handle.stop();
  });

  it("renders immediately on creation", () => {
    const writeSpy = vi.spyOn(process.stdout, "write");
    const handle = showStatusWithSpinner("Test", "Loading...", []);

    // Should have written to stdout for initial render
    expect(writeSpy).toHaveBeenCalled();
    handle.stop();
  });

  it("stops animation when stop is called", () => {
    const writeSpy = vi.spyOn(process.stdout, "write");
    const handle = showStatusWithSpinner("Test", "Loading...", []);

    // Clear call count after initial render
    writeSpy.mockClear();

    // Stop the spinner
    handle.stop();

    // Advance timers - should not trigger more renders after stop
    vi.advanceTimersByTime(500);

    // No additional writes after stop
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("animates spinner frames over time", () => {
    const writeSpy = vi.spyOn(process.stdout, "write");
    const handle = showStatusWithSpinner("Test", "Loading...", []);

    // Clear initial render
    const initialCallCount = writeSpy.mock.calls.length;

    // Advance time by 80ms (one spinner frame interval)
    vi.advanceTimersByTime(80);

    // Should have rendered another frame
    expect(writeSpy.mock.calls.length).toBeGreaterThan(initialCallCount);

    handle.stop();
  });
});
