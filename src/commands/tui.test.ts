import { beforeEach, describe, expect, it, vi } from "vitest";
import * as aiProvider from "../lib/ai-provider.js";
import * as display from "../tui/display.js";
import * as modal from "../tui/modal.js";
import * as github from "../lib/github.js";
import * as git from "../lib/git.js";
import * as branch from "../lib/branch.js";
import type { TuiState } from "../tui/state.js";
import { executeAction } from "./tui.js";

// Mock dependencies
vi.mock("../tui/display.js");
vi.mock("../tui/modal.js");
vi.mock("../lib/ai-provider.js");
vi.mock("../lib/config.js", () => ({
  loadAgentInstructions: () => "mock instructions",
  loadConfig: () => ({
    labels: {},
  }),
  setRuntimeProvider: vi.fn(),
}));
vi.mock("../lib/prompts.js", () => ({
  buildImplementationPrompt: () => "mock prompt",
  buildCommitMessagePrompt: () => "mock commit prompt",
}));
vi.mock("../lib/progress.js", () => ({
  readProgress: () => "mock progress",
}));
vi.mock("../lib/github.js", () => ({
  listIssues: vi.fn().mockResolvedValue([]),
  listOpenPrs: vi.fn().mockResolvedValue([]),
}));
vi.mock("../lib/git.js", () => ({
  getCurrentBranch: vi.fn().mockResolvedValue("main"),
  getDefaultBranch: vi.fn().mockResolvedValue("main"),
  hasUncommittedChanges: vi.fn().mockResolvedValue(false),
  branchExists: vi.fn().mockResolvedValue(false),
  checkoutBranch: vi.fn().mockResolvedValue(undefined),
  createBranch: vi.fn().mockResolvedValue(undefined),
  listLocalBranches: vi.fn().mockResolvedValue([]),
  remoteBranchExists: vi.fn().mockResolvedValue(false),
  fetchAndCheckout: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../lib/labels.js", () => ({
  getWorkflowLabels: () => ({
    ready: "ai-ready",
    inProgress: "ai-in-progress",
    completed: "ai-completed",
    blocked: "ai-blocked",
  }),
  sortByPriority: vi.fn(),
}));
vi.mock("../lib/branch.js", () => ({
  generateBranchName: vi.fn().mockResolvedValue("ro/feature-1-test"),
  parseBranchName: vi.fn().mockImplementation((branch: string) => {
    // Simple parser: extract issue number from branch name like "ro/feature-5-some-feature"
    const match = branch.match(/(\w+)-(\d+)-/);
    if (match) {
      return { issueNumber: parseInt(match[2], 10), type: match[1] };
    }
    return null;
  }),
}));

describe("executeAction", () => {
  let mockState: TuiState;
  const mockDashboardLines = ["line1", "line2"];

  beforeEach(() => {
    vi.resetAllMocks();
    mockState = {
      isGitRepo: true,
      isGhAuthenticated: true,
      isAIProviderAvailable: true,
      // @ts-expect-error - minimal config for test
      config: { ai: { provider: "claude" } as any },
      hasConfig: true,
      hasProgress: false,
      branch: "feature-branch",
      branchInfo: null,
      isOnMain: false,
      hasUncommittedChanges: false,
      hasUnpushedCommits: false,
      commits: [],
      baseBranch: "main",
      issue: {
        number: 123,
        title: "Test Issue",
        body: "Body",
        labels: [],
        state: "open",
        url: "url",
      },
      workflowStatus: "in-progress",
      pr: null,
      reviewFeedback: [],
      hasActionableFeedback: false,
      hasUIChanges: false,
      isPlaywrightAvailable: false,
    };
  });

  it("returns quit for quit action", async () => {
    const result = await executeAction("quit", mockState, mockDashboardLines);
    expect(result.running).toBe(false);
  });

  it("returns continue for 'run' action after completion (no confirm needed)", async () => {
    // Mock AI invocation — no confirm dialog needed anymore
    vi.mocked(aiProvider.invokeAIInteractive).mockResolvedValue({
      // @ts-expect-error - minimal AI response for test
      result: Promise.resolve({} as any),
      provider: "claude",
    });

    const result = await executeAction("run", mockState, mockDashboardLines);

    expect(result.running).toBe(true);
    expect(result.refresh).toBe(true);
    expect(aiProvider.invokeAIInteractive).toHaveBeenCalled();
    expect(display.clearScreen).toHaveBeenCalled();
  });

  it("returns continue for 'pr' action (no confirm needed)", async () => {
    // prCommand is imported directly, mock it via the module
    const pr = await import("./pr.js");
    vi.spyOn(pr, "prCommand").mockResolvedValue();

    const result = await executeAction("pr", mockState, mockDashboardLines);

    expect(result.running).toBe(true);
    expect(result.refresh).toBe(true);
    expect(display.clearScreen).toHaveBeenCalled();
  });

  it("skips refresh for 'create' action when cancelled via modal", async () => {
    vi.mocked(modal.showMultilineInput).mockResolvedValue(null);

    const result = await executeAction("create", mockState, mockDashboardLines);

    expect(result.running).toBe(true);
    expect(result.refresh).toBe(false);
    expect(modal.showMultilineInput).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "New Ticket",
        label: "Describe the ticket:",
      })
    );
  });

  it("skips refresh for 'switch-provider' using modal select", async () => {
    vi.mocked(modal.showSelect).mockResolvedValue("gemini");

    const result = await executeAction("switch-provider", mockState, mockDashboardLines);

    expect(result.running).toBe(true);
    expect(result.refresh).toBe(false);
    expect(modal.showSelect).toHaveBeenCalledWith(
      expect.objectContaining({ title: "AI Provider" })
    );
  });

  it("returns continue for 'refresh' action", async () => {
    const result = await executeAction("refresh", mockState, mockDashboardLines);

    expect(result.running).toBe(true);
    expect(result.refresh).toBe(true);
  });

  it("returns true for 'list' action and shows modal select with tickets", async () => {
    // Mock GitHub data
    vi.mocked(github.listIssues).mockResolvedValue([
      {
        number: 10,
        title: "Ready ticket",
        body: "",
        labels: ["ai-ready"],
        state: "open",
        url: "url",
      },
    ]);
    vi.mocked(github.listOpenPrs).mockResolvedValue([]);
    vi.mocked(git.listLocalBranches).mockResolvedValue([]);

    // User cancels the select modal
    vi.mocked(modal.showSelect).mockResolvedValue(null);

    const result = await executeAction("list", mockState, mockDashboardLines);

    expect(result.running).toBe(true);
    // Should show loading status first
    expect(modal.showStatus).toHaveBeenCalledWith(
      "Loading",
      "Fetching tickets...",
      mockDashboardLines
    );
    // Should show the select modal
    expect(modal.showSelect).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Switch Ticket" })
    );
  });

  it("'list' action switches branch on ticket selection", async () => {
    vi.mocked(github.listIssues)
      .mockResolvedValueOnce([]) // in-progress
      .mockResolvedValueOnce([
        {
          number: 5,
          title: "Some feature",
          body: "",
          labels: ["ai-ready"],
          state: "open",
          url: "url",
        },
      ]);
    vi.mocked(github.listOpenPrs).mockResolvedValue([]);
    vi.mocked(git.listLocalBranches).mockResolvedValue(["ro/feature-5-some-feature"]);
    vi.mocked(git.getCurrentBranch).mockResolvedValue("main");
    vi.mocked(git.getDefaultBranch).mockResolvedValue("main");
    vi.mocked(git.branchExists).mockResolvedValue(true);
    vi.mocked(git.hasUncommittedChanges).mockResolvedValue(false);

    // User selects ticket #5
    vi.mocked(modal.showSelect).mockResolvedValue("5");

    // parseBranchName mock is reset by resetAllMocks — re-set it
    vi.mocked(branch.parseBranchName).mockImplementation((name: string) => {
      const m = name.match(/(\w+)-(\d+)-/);
      if (m) return { name, issueNumber: parseInt(m[2], 10), type: m[1], slug: "test", author: "ro" };
      return null;
    });

    const result = await executeAction("list", mockState, mockDashboardLines);

    expect(result.running).toBe(true);
    expect(modal.showSelect).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Switch Ticket" })
    );
    expect(git.checkoutBranch).toHaveBeenCalledWith("ro/feature-5-some-feature");
  });

  it("'list' action shows warning for disabled main branch when dirty", async () => {
    vi.mocked(github.listIssues).mockResolvedValue([]);
    vi.mocked(github.listOpenPrs).mockResolvedValue([]);
    vi.mocked(git.listLocalBranches).mockResolvedValue([]);
    vi.mocked(git.getCurrentBranch).mockResolvedValue("ro/feature-1-test");
    vi.mocked(git.getDefaultBranch).mockResolvedValue("main");
    vi.mocked(git.hasUncommittedChanges).mockResolvedValue(true);

    // User selects the disabled main branch option
    vi.mocked(modal.showSelect).mockResolvedValue("__main_disabled__");

    const result = await executeAction("list", mockState, mockDashboardLines);

    expect(result.running).toBe(true);
    expect(result.refresh).toBe(false);
    expect(modal.showStatus).toHaveBeenCalledWith(
      "Uncommitted Changes",
      "Commit or stash changes before switching to main",
      mockDashboardLines
    );
  });
});
