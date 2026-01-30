import { describe, it, expect, vi } from "vitest";
import { buildDashboardLines, stripAnsi } from "./display.js";
import type { TuiState } from "./state.js";
import type { TuiAction } from "./actions.js";

// Mock version to avoid package.json read
vi.mock("../lib/version.js", () => ({
  getVersion: () => "1.0.0",
}));

// Mock config loading
vi.mock("../lib/config.js", () => ({
  loadConfig: () => ({
    ai: { provider: "claude" },
    video: { enabled: true },
  }),
}));

const mockBaseState: TuiState = {
  isGitRepo: true,
  isGhAuthenticated: true,
  isAIProviderAvailable: true,
  config: {
    ai: { provider: "claude" },
    video: { enabled: true },
    labels: {
      "ai-ready": "ai-ready",
      "ai-in-progress": "ai-in-progress",
      "ai-completed": "ai-completed",
      "ai-blocked": "ai-blocked",
    },
  } as any,
  hasConfig: true,
  hasProgress: true,
  branch: "feature-branch",
  branchInfo: null,
  isOnMain: false,
  hasUncommittedChanges: false,
  hasUnpushedCommits: false,
  commits: [],
  baseBranch: "main",
  issue: null,
  workflowStatus: "none",
  pr: null,
  reviewFeedback: [],
  hasActionableFeedback: false,
  hasUIChanges: false,
  isPlaywrightAvailable: false,
};

const mockActions: TuiAction[] = [
  { label: "run", shortcut: "u", handler: async () => {} },
];

describe("display", () => {
  describe("buildDashboardLines", () => {
    it("renders feature branch with all sections", () => {
      const state: TuiState = {
        ...mockBaseState,
        branch: "ro/feat-1-test",
        isOnMain: false,
      };

      const lines = buildDashboardLines(state, mockActions).map(stripAnsi);
      const output = lines.join("\n");

      expect(output).toContain("Ticket");
      expect(output).toContain("Branch");
      expect(output).toContain("Pull Request");
      expect(output).toContain("Commits");
      expect(output).toContain("ro/feat-1-test");
      expect(output).toContain("No linked issue");
      expect(output).toContain("No PR created");
    });

    it("renders main branch without Ticket, PR, and Commits sections if empty", () => {
      const state: TuiState = {
        ...mockBaseState,
        branch: "main",
        isOnMain: true,
      };

      const lines = buildDashboardLines(state, mockActions).map(stripAnsi);
      const output = lines.join("\n");

      expect(output).not.toContain("Ticket");
      expect(output).toContain("Branch");
      expect(output).not.toContain("Pull Request");
      expect(output).not.toContain("Commits");
      expect(output).toContain("main");
      expect(output).toContain("ready to start new work");
    });

    it("renders main branch with Commits if there are unpushed commits", () => {
      // Note: on main, state.commits will be empty (commits since baseBranch), 
      // but let's assume some scenario where we want to show them if they exist.
      // Actually, my logic was: if (state.commits.length > 0 || !state.isOnMain)
      const state: TuiState = {
        ...mockBaseState,
        branch: "main",
        isOnMain: true,
        commits: ["feat: something"],
      };

      const lines = buildDashboardLines(state, mockActions).map(stripAnsi);
      const output = lines.join("\n");

      expect(output).toContain("Branch");
      expect(output).toContain("main");
      expect(output).toContain("Commits");
      expect(output).toContain("feat: something");
    });

    it("renders main branch with uncommitted changes", () => {
      const state: TuiState = {
        ...mockBaseState,
        branch: "main",
        isOnMain: true,
        hasUncommittedChanges: true,
      };

      const lines = buildDashboardLines(state, mockActions).map(stripAnsi);
      const output = lines.join("\n");

      expect(output).toContain("Branch");
      expect(output).toContain("main");
      expect(output).toContain("uncommitted");
      expect(output).not.toContain("ready to start new work");
    });
  });
});
