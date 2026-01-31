import { describe, it, expect, vi, beforeAll } from "vitest";
import chalk from "chalk";
import { buildDashboardLines, stripAnsi, truncateAnsi } from "./display.js";
import type { TuiState } from "./state.js";
import type { TuiAction } from "./actions.js";

beforeAll(() => {
  process.env.FORCE_COLOR = "1";
});

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
  hasValidRemote: true,
};

const mockActions: TuiAction[] = [
  { id: "run", label: "run", shortcut: "r" },
];

describe("display", () => {
  describe("truncateAnsi", () => {
    it("does not truncate short strings", () => {
      expect(truncateAnsi("hello", 10)).toBe("hello");
    });

    it("truncates long strings", () => {
      expect(stripAnsi(truncateAnsi("hello world", 5))).toBe("hell…");
    });

    it("respects ANSI codes when truncating", () => {
      const input = chalk.red("hello") + " " + chalk.blue("world");
      const truncated = truncateAnsi(input, 7);
      expect(stripAnsi(truncated)).toBe("hello …");
      expect(truncated).toContain("hello");
      expect(truncated).toContain("\x1b[0m…");
    });
  });

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
      expect(output).toContain("· ro/feat-1-test");
      expect(output).toContain("  No linked issue");
      expect(output).toContain("  No PR created");
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
      expect(output).toContain("· main");
      expect(output).toContain("ready to start new work");
    });

    it("renders main branch with Commits if there are unpushed commits", () => {
      const state: TuiState = {
        ...mockBaseState,
        branch: "main",
        isOnMain: true,
        commits: ["feat: something"],
      };

      const lines = buildDashboardLines(state, mockActions).map(stripAnsi);
      const output = lines.join("\n");

      expect(output).toContain("Branch");
      expect(output).toContain("· main");
      expect(output).toContain("Commits");
      expect(output).toContain("· feat: something");
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
      expect(output).toContain("· main");
      expect(output).toContain("uncommitted");
      expect(output).not.toContain("ready to start new work");
    });

    it("renders update notification when newer version available", () => {
      const state: TuiState = {
        ...mockBaseState,
        branch: "main",
        isOnMain: true,
      };

      const versionCheck = {
        currentVersion: "1.0.0",
        latestVersion: "1.1.0",
        updateAvailable: true,
        lastChecked: Date.now(),
      };

      const lines = buildDashboardLines(state, mockActions, undefined, false, versionCheck).map(stripAnsi);
      const output = lines.join("\n");

      expect(output).toContain("Update available: 1.0.0 → 1.1.0");
      expect(output).toContain("npm install -g @rotorsoft/gent");
    });

    it("does not render update notification when up-to-date", () => {
      const state: TuiState = {
        ...mockBaseState,
        branch: "main",
        isOnMain: true,
      };

      const versionCheck = {
        currentVersion: "1.0.0",
        latestVersion: "1.0.0",
        updateAvailable: false,
        lastChecked: Date.now(),
      };

      const lines = buildDashboardLines(state, mockActions, undefined, false, versionCheck).map(stripAnsi);
      const output = lines.join("\n");

      expect(output).not.toContain("Update available");
    });

    it("does not render update notification when no version check result", () => {
      const state: TuiState = {
        ...mockBaseState,
        branch: "main",
        isOnMain: true,
      };

      const lines = buildDashboardLines(state, mockActions).map(stripAnsi);
      const output = lines.join("\n");

      expect(output).not.toContain("Update available");
    });

    it("renders helpful message and quit command when not in a git repo", () => {
      const state: TuiState = {
        ...mockBaseState,
        isGitRepo: false,
        isGhAuthenticated: false,
        branch: "",
        isOnMain: false,
      };

      const quitAction: TuiAction[] = [
        { id: "quit", label: "quit", shortcut: "q" },
      ];

      const lines = buildDashboardLines(state, quitAction).map(stripAnsi);
      const output = lines.join("\n");

      expect(output).toContain("Not a git repository");
      expect(output).toContain("Navigate to a git repository to get started");
      expect(output).toContain("quit");
      // Should not render git-specific sections
      expect(output).not.toContain("Branch");
      expect(output).not.toContain("Ticket");
      expect(output).not.toContain("Commits");
    });

    it("renders quit command when GitHub CLI not authenticated", () => {
      const state: TuiState = {
        ...mockBaseState,
        isGhAuthenticated: false,
      };

      const quitAction: TuiAction[] = [
        { id: "quit", label: "quit", shortcut: "q" },
      ];

      const lines = buildDashboardLines(state, quitAction).map(stripAnsi);
      const output = lines.join("\n");

      expect(output).toContain("GitHub CLI not authenticated");
      expect(output).toContain("quit");
    });

    it("renders hint when hasValidRemote is false in a git repo", () => {
      const state: TuiState = {
        ...mockBaseState,
        branch: "main",
        isOnMain: true,
        hasValidRemote: false,
      };

      const lines = buildDashboardLines(state, mockActions).map(stripAnsi);
      const output = lines.join("\n");

      expect(output).toContain("Hint");
      expect(output).toContain(
        "Add a GitHub remote to create tickets and pull requests"
      );
    });

    it("does not render remote hint when hasValidRemote is true", () => {
      const state: TuiState = {
        ...mockBaseState,
        branch: "main",
        isOnMain: true,
        hasValidRemote: true,
      };

      const lines = buildDashboardLines(state, mockActions).map(stripAnsi);
      const output = lines.join("\n");

      expect(output).not.toContain(
        "Add a GitHub remote to create tickets and pull requests"
      );
    });

    it("renders bullets for list items", () => {
      const state: TuiState = {
        ...mockBaseState,
        branch: "ro/feat-1-test",
        isOnMain: false,
        issue: {
          number: 1,
          title: "Test Issue",
          body: "Desc",
          labels: ["type:feat"],
        } as any,
        commits: ["feat: commit 1"],
      };

      const lines = buildDashboardLines(state, mockActions).map(stripAnsi);
      const output = lines.join("\n");

      expect(output).toContain("· #1 Test Issue");
      expect(output).toContain("· feat: commit 1");
      expect(output).toContain("· ro/feat-1-test");
    });
  });
});