import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all dependencies
vi.mock("../lib/config.js", () => ({
  loadConfig: vi.fn(() => ({
    version: 1,
    github: {
      labels: {
        workflow: { ready: "ai-ready", in_progress: "ai-in-progress", completed: "ai-completed", blocked: "ai-blocked" },
        types: ["feature", "fix"],
        priorities: ["high", "medium", "low"],
        risks: ["low", "medium", "high"],
        areas: ["ui", "api"],
      },
    },
    branch: { pattern: "{author}/{type}-{issue}-{slug}", author_source: "git", author_env_var: "GENT_AUTHOR" },
    progress: { file: "progress.txt", archive_threshold: 500, archive_dir: ".gent/archive" },
    ai: { provider: "claude", auto_fallback: false },
    video: { enabled: true, max_duration: 30, width: 1280, height: 720 },
    validation: ["npm run typecheck", "npm run lint", "npm run test"],
    claude: { permission_mode: "default", agent_file: "AGENT.md" },
    gemini: { sandbox_mode: "default", agent_file: "AGENT.md" },
    codex: { agent_file: "AGENT.md" },
  })),
  configExists: vi.fn(() => true),
}));

vi.mock("../lib/github.js", () => ({
  getIssue: vi.fn(),
  getPrStatus: vi.fn(),
  getPrReviewData: vi.fn(),
}));

vi.mock("../lib/git.js", () => ({
  getCurrentBranch: vi.fn(),
  isOnMainBranch: vi.fn(),
  hasUncommittedChanges: vi.fn(),
  getUnpushedCommits: vi.fn(),
  getCommitsSinceBase: vi.fn(),
  getDefaultBranch: vi.fn(),
  getLastCommitTimestamp: vi.fn(),
}));

vi.mock("../lib/branch.js", () => ({
  extractIssueNumber: vi.fn(),
  parseBranchName: vi.fn(),
}));

vi.mock("../lib/labels.js", () => ({
  getWorkflowLabels: vi.fn(() => ({
    ready: "ai-ready",
    inProgress: "ai-in-progress",
    completed: "ai-completed",
    blocked: "ai-blocked",
  })),
}));

vi.mock("../lib/progress.js", () => ({
  progressExists: vi.fn(() => true),
}));

vi.mock("../utils/validators.js", () => ({
  checkGhAuth: vi.fn(),
  checkAIProvider: vi.fn(),
  checkGitRepo: vi.fn(),
}));

vi.mock("../lib/review-feedback.js", () => ({
  summarizeReviewFeedback: vi.fn(() => ({ summary: "", items: [] })),
}));

vi.mock("../lib/playwright.js", () => ({
  hasUIChanges: vi.fn(),
  getChangedFiles: vi.fn(),
  isPlaywrightAvailable: vi.fn(),
}));

import { aggregateState } from "./state.js";
import * as git from "../lib/git.js";
import * as github from "../lib/github.js";
import * as branch from "../lib/branch.js";
import * as validators from "../utils/validators.js";
import * as playwright from "../lib/playwright.js";

describe("aggregateState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns minimal state when not a git repo", async () => {
    vi.mocked(validators.checkGitRepo).mockResolvedValue(false);

    const state = await aggregateState();

    expect(state.isGitRepo).toBe(false);
    expect(state.isGhAuthenticated).toBe(false);
    expect(state.branch).toBe("");
  });

  it("detects main branch state correctly", async () => {
    vi.mocked(validators.checkGitRepo).mockResolvedValue(true);
    vi.mocked(validators.checkGhAuth).mockResolvedValue(true);
    vi.mocked(validators.checkAIProvider).mockResolvedValue(true);
    vi.mocked(git.getCurrentBranch).mockResolvedValue("main");
    vi.mocked(git.isOnMainBranch).mockResolvedValue(true);
    vi.mocked(git.hasUncommittedChanges).mockResolvedValue(false);
    vi.mocked(git.getDefaultBranch).mockResolvedValue("main");
    vi.mocked(git.getCommitsSinceBase).mockResolvedValue([]);
    vi.mocked(git.getUnpushedCommits).mockResolvedValue(false);
    vi.mocked(branch.parseBranchName).mockReturnValue(null);

    const state = await aggregateState();

    expect(state.isGitRepo).toBe(true);
    expect(state.isOnMain).toBe(true);
    expect(state.branch).toBe("main");
    expect(state.issue).toBeNull();
    expect(state.pr).toBeNull();
  });

  it("detects feature branch with issue correctly", async () => {
    vi.mocked(validators.checkGitRepo).mockResolvedValue(true);
    vi.mocked(validators.checkGhAuth).mockResolvedValue(true);
    vi.mocked(validators.checkAIProvider).mockResolvedValue(true);
    vi.mocked(git.getCurrentBranch).mockResolvedValue("ro/feature-123-add-tui");
    vi.mocked(git.isOnMainBranch).mockResolvedValue(false);
    vi.mocked(git.hasUncommittedChanges).mockResolvedValue(true);
    vi.mocked(git.getDefaultBranch).mockResolvedValue("main");
    vi.mocked(git.getCommitsSinceBase).mockResolvedValue(["feat: add TUI", "fix: typo"]);
    vi.mocked(git.getUnpushedCommits).mockResolvedValue(true);
    vi.mocked(branch.parseBranchName).mockReturnValue({
      name: "ro/feature-123-add-tui",
      author: "ro",
      type: "feature",
      issueNumber: 123,
      slug: "add-tui",
    });
    vi.mocked(branch.extractIssueNumber).mockReturnValue(123);
    vi.mocked(github.getIssue).mockResolvedValue({
      number: 123,
      title: "Add TUI",
      body: "Description",
      labels: ["ai-in-progress", "type:feature"],
      state: "open",
      url: "https://github.com/test/repo/issues/123",
    });
    vi.mocked(github.getPrStatus).mockResolvedValue(null);
    vi.mocked(playwright.getChangedFiles).mockResolvedValue(["src/tui/index.tsx"]);
    vi.mocked(playwright.hasUIChanges).mockReturnValue(true);
    vi.mocked(playwright.isPlaywrightAvailable).mockResolvedValue(true);

    const state = await aggregateState();

    expect(state.isOnMain).toBe(false);
    expect(state.branch).toBe("ro/feature-123-add-tui");
    expect(state.branchInfo?.issueNumber).toBe(123);
    expect(state.hasUncommittedChanges).toBe(true);
    expect(state.hasUnpushedCommits).toBe(true);
    expect(state.commits).toHaveLength(2);
    expect(state.issue?.number).toBe(123);
    expect(state.workflowStatus).toBe("in-progress");
    expect(state.hasUIChanges).toBe(true);
    expect(state.isPlaywrightAvailable).toBe(true);
  });

  it("detects PR with actionable feedback", async () => {
    vi.mocked(validators.checkGitRepo).mockResolvedValue(true);
    vi.mocked(validators.checkGhAuth).mockResolvedValue(true);
    vi.mocked(validators.checkAIProvider).mockResolvedValue(true);
    vi.mocked(git.getCurrentBranch).mockResolvedValue("ro/feature-123-add-tui");
    vi.mocked(git.isOnMainBranch).mockResolvedValue(false);
    vi.mocked(git.hasUncommittedChanges).mockResolvedValue(false);
    vi.mocked(git.getDefaultBranch).mockResolvedValue("main");
    vi.mocked(git.getCommitsSinceBase).mockResolvedValue(["feat: add TUI"]);
    vi.mocked(git.getUnpushedCommits).mockResolvedValue(false);
    vi.mocked(git.getLastCommitTimestamp).mockResolvedValue("2024-01-01T00:00:00Z");
    vi.mocked(branch.parseBranchName).mockReturnValue(null);
    vi.mocked(branch.extractIssueNumber).mockReturnValue(123);
    vi.mocked(github.getIssue).mockResolvedValue({
      number: 123,
      title: "Add TUI",
      body: "Description",
      labels: ["ai-in-progress"],
      state: "open",
      url: "https://github.com/test/repo/issues/123",
    });
    vi.mocked(github.getPrStatus).mockResolvedValue({
      number: 456,
      url: "https://github.com/test/repo/pull/456",
      state: "open",
      reviewDecision: "CHANGES_REQUESTED",
      isDraft: false,
    });
    vi.mocked(github.getPrReviewData).mockResolvedValue({
      reviews: [],
      reviewThreads: [],
      comments: [],
    });
    vi.mocked(playwright.getChangedFiles).mockResolvedValue([]);
    vi.mocked(playwright.hasUIChanges).mockReturnValue(false);
    vi.mocked(playwright.isPlaywrightAvailable).mockResolvedValue(false);

    // Mock summarizeReviewFeedback to return actionable items
    const { summarizeReviewFeedback } = await import("../lib/review-feedback.js");
    vi.mocked(summarizeReviewFeedback).mockReturnValue({
      summary: "1 actionable item",
      items: [{ source: "comment" as const, body: "Please fix this", author: "reviewer" }],
    });

    const state = await aggregateState();

    expect(state.pr?.number).toBe(456);
    expect(state.pr?.state).toBe("open");
    expect(state.hasActionableFeedback).toBe(true);
    expect(state.reviewFeedback).toHaveLength(1);
  });
});
