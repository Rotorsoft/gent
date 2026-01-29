import { describe, it, expect } from "vitest";
import { buildTicketPrompt, parseTicketMeta, extractIssueBody, buildImplementationPrompt, extractTitle, generateFallbackTitle } from "./prompts.js";
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

  it("should include extra context when provided", () => {
    const config = createTestConfig("claude");
    const prompt = buildImplementationPrompt(
      mockIssue,
      null,
      null,
      config,
      "## Review Feedback\n- [Review] @alice: Please update the logic."
    );
    expect(prompt).toContain("## Review Feedback");
    expect(prompt).toContain("@alice");
  });

  it("should include multiple context sections", () => {
    const config = createTestConfig("claude");
    const prompt = buildImplementationPrompt(
      mockIssue,
      null,
      null,
      config,
      "## Current Progress\n- feat: initial work\n\n## Review Feedback\n- Fix the tests"
    );
    expect(prompt).toContain("## Current Progress");
    expect(prompt).toContain("## Review Feedback");
    expect(prompt).toContain("Fix the tests");
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

  it("should strip TITLE line from output", () => {
    const output = `TITLE: Add dark mode support

## Description
Content here
META:type=feature,priority=high,risk=low,area=ui`;
    const body = extractIssueBody(output);
    expect(body).toBe("## Description\nContent here");
    expect(body).not.toContain("TITLE:");
  });
});

describe("extractTitle", () => {
  it("should extract valid title from AI output", () => {
    const output = `TITLE: Add OAuth2 authentication for Google and GitHub

## Description
Content here`;
    const title = extractTitle(output);
    expect(title).toBe("Add OAuth2 authentication for Google and GitHub");
  });

  it("should return null when no TITLE line present", () => {
    const output = `## Description
Content here`;
    const title = extractTitle(output);
    expect(title).toBeNull();
  });

  it("should return null for template placeholder", () => {
    const output = `TITLE: [Concise issue title in imperative mood, 30-72 characters]

## Description
Content here`;
    const title = extractTitle(output);
    expect(title).toBeNull();
  });

  it("should strip surrounding quotes", () => {
    const output = `TITLE: "Add user authentication"

## Description
Content here`;
    const title = extractTitle(output);
    expect(title).toBe("Add user authentication");
  });

  it("should strip single quotes", () => {
    const output = `TITLE: 'Add user authentication'

## Description
Content here`;
    const title = extractTitle(output);
    expect(title).toBe("Add user authentication");
  });

  it("should return null for title that is too short", () => {
    const output = `TITLE: Fix

## Description
Content here`;
    const title = extractTitle(output);
    expect(title).toBeNull();
  });

  it("should return null for title that is too long", () => {
    const longTitle = "A".repeat(201);
    const output = `TITLE: ${longTitle}

## Description
Content here`;
    const title = extractTitle(output);
    expect(title).toBeNull();
  });

  it("should accept titles up to 200 characters", () => {
    const longTitle = "A".repeat(200);
    const output = `TITLE: ${longTitle}

## Description
Content here`;
    const title = extractTitle(output);
    expect(title).toBe(longTitle);
  });

  it("should handle TITLE line anywhere in output", () => {
    const output = `Some preamble text

TITLE: Add dark mode support

## Description
Content here`;
    const title = extractTitle(output);
    expect(title).toBe("Add dark mode support");
  });
});

describe("generateFallbackTitle", () => {
  it("should return description as-is when under limit", () => {
    const description = "Add dark mode support";
    const title = generateFallbackTitle(description);
    expect(title).toBe("Add dark mode support");
  });

  it("should return description as-is when under 200 chars", () => {
    const description = "Add user authentication with OAuth2 support for Google and GitHub providers";
    const title = generateFallbackTitle(description);
    expect(title).toBe(description);
  });

  it("should handle exactly 200 character descriptions", () => {
    const description = "A".repeat(200);
    const title = generateFallbackTitle(description);
    expect(title).toBe(description);
  });

  it("should truncate at word boundary without ellipsis", () => {
    const description = "This is a very long description that exceeds the two hundred character limit and should be truncated at a word boundary to ensure the title remains readable without any ellipsis characters at the end of it";
    const title = generateFallbackTitle(description);
    expect(title.length).toBeLessThanOrEqual(200);
    expect(title).not.toContain("...");
    expect(title.endsWith(" ")).toBe(false);
  });

  it("should truncate at exact length if no suitable word boundary", () => {
    const description = "A".repeat(250);
    const title = generateFallbackTitle(description);
    expect(title.length).toBe(200);
  });
});
