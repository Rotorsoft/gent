import { describe, it, expect } from "vitest";
import { buildTicketPrompt, parseTicketMeta, extractIssueBody } from "./claude.js";

describe("buildTicketPrompt", () => {
  it("should build basic prompt with description", () => {
    const prompt = buildTicketPrompt("Add dark mode", null);
    expect(prompt).toContain("User Request: Add dark mode");
  });

  it("should include agent instructions when provided", () => {
    const prompt = buildTicketPrompt("Add dark mode", "Use TypeScript");
    expect(prompt).toContain("Project-Specific Instructions:");
    expect(prompt).toContain("Use TypeScript");
  });

  it("should include additional hints when provided", () => {
    const prompt = buildTicketPrompt("Add dark mode", null, "Focus on CSS variables");
    expect(prompt).toContain("Additional Context/Hints:");
    expect(prompt).toContain("Focus on CSS variables");
  });

  it("should include all parts when everything is provided", () => {
    const prompt = buildTicketPrompt(
      "Add dark mode",
      "Use TypeScript",
      "Focus on CSS variables"
    );
    expect(prompt).toContain("User Request: Add dark mode");
    expect(prompt).toContain("Project-Specific Instructions:");
    expect(prompt).toContain("Use TypeScript");
    expect(prompt).toContain("Additional Context/Hints:");
    expect(prompt).toContain("Focus on CSS variables");
  });
});

describe("parseTicketMeta", () => {
  it("should parse valid META line", () => {
    const output = "Some content\nMETA:type=feature,priority=high,risk=low,area=ui";
    const meta = parseTicketMeta(output);
    expect(meta).toEqual({
      type: "feature",
      priority: "high",
      risk: "low",
      area: "ui",
    });
  });

  it("should return null for invalid META line", () => {
    const output = "Some content without META";
    const meta = parseTicketMeta(output);
    expect(meta).toBeNull();
  });

  it("should handle META line in middle of output", () => {
    const output = "Content before\nMETA:type=fix,priority=critical,risk=high,area=api\nContent after";
    const meta = parseTicketMeta(output);
    expect(meta).toEqual({
      type: "fix",
      priority: "critical",
      risk: "high",
      area: "api",
    });
  });
});

describe("extractIssueBody", () => {
  it("should remove META line from end of output", () => {
    const output = "Issue body content\nMETA:type=feature,priority=high,risk=low,area=ui";
    const body = extractIssueBody(output);
    expect(body).toBe("Issue body content");
  });

  it("should handle output without META line", () => {
    const output = "Issue body content";
    const body = extractIssueBody(output);
    expect(body).toBe("Issue body content");
  });

  it("should preserve multi-line content before META", () => {
    const output = "Line 1\nLine 2\nLine 3\nMETA:type=feature,priority=high,risk=low,area=ui";
    const body = extractIssueBody(output);
    expect(body).toBe("Line 1\nLine 2\nLine 3");
  });
});
