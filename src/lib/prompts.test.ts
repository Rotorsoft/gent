import { describe, it, expect } from "vitest";
import { buildTicketPrompt, parseTicketMeta, extractIssueBody, buildImplementationPrompt } from "./prompts.js";
import type { GentConfig } from "../types/index.js";

// Minimal config for testing
const createTestConfig = (provider: "claude" | "gemini"): GentConfig => ({
  version: 1,
  github: {
    labels: {
      workflow: {
        ready: "ai-ready",
        in_progress: "ai-in-progress",
        completed: "ai-completed",
        blocked: "ai-blocked",
      },
      types: ["feature", "fix"],
      priorities: ["high", "medium", "low"],
      risks: ["high", "medium", "low"],
      areas: ["api", "ui"],
    },
  },
  branch: {
    pattern: "{author}/{type}-{issue}-{slug}",
    author_source: "git",
    author_env_var: "USER",
  },
  progress: {
    file: "progress.txt",
    archive_threshold: 500,
    archive_dir: ".gent/archive",
  },
  claude: {
    permission_mode: "default",
    agent_file: "AGENT.md",
  },
  gemini: {
    sandbox_mode: "default",
    agent_file: "AGENT.md",
  },
  ai: {
    provider,
    auto_fallback: false,
  },
  validation: ["npm run typecheck"],
});

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

describe("buildImplementationPrompt", () => {
  const mockIssue = {
    number: 123,
    title: "Test Issue",
    body: "Test body",
  };

  it("should include Claude signature when provider is claude", () => {
    const config = createTestConfig("claude");
    const prompt = buildImplementationPrompt(mockIssue, null, null, config);
    expect(prompt).toContain("Co-Authored-By: Claude <noreply@anthropic.com>");
  });

  it("should include Gemini signature when provider is gemini", () => {
    const config = createTestConfig("gemini");
    const prompt = buildImplementationPrompt(mockIssue, null, null, config);
    expect(prompt).toContain("Co-Authored-By: Gemini <noreply@google.com>");
  });

  it("should include validation commands", () => {
    const config = createTestConfig("claude");
    const prompt = buildImplementationPrompt(mockIssue, null, null, config);
    expect(prompt).toContain("npm run typecheck");
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

  it("should strip preamble text before ## Description", () => {
    const output = "Here's a GitHub issue for you:\n\n## Description\nActual content";
    const body = extractIssueBody(output);
    expect(body).toBe("## Description\nActual content");
  });

  it("should strip preamble and META line together", () => {
    const output = "I'll create this issue:\n\n## Description\nContent here\nMETA:type=feature,priority=high,risk=low,area=ui";
    const body = extractIssueBody(output);
    expect(body).toBe("## Description\nContent here");
  });

  it("should handle output starting with ## Description (no preamble)", () => {
    const output = "## Description\nContent here\nMETA:type=feature,priority=high,risk=low,area=ui";
    const body = extractIssueBody(output);
    expect(body).toBe("## Description\nContent here");
  });

  it("should preserve full issue body after stripping preamble", () => {
    const output = `Sure, here's the issue:

## Description
Add dark mode support

## Technical Context
**Type:** feature

## Implementation Steps
- [ ] Step 1
META:type=feature,priority=high,risk=low,area=ui`;
    const body = extractIssueBody(output);
    expect(body).toContain("## Description");
    expect(body).toContain("## Technical Context");
    expect(body).toContain("## Implementation Steps");
    expect(body).not.toContain("Sure, here's the issue");
    expect(body).not.toContain("META:");
  });
});
