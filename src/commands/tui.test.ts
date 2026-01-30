import { beforeEach, describe, expect, it, vi } from "vitest";
import * as aiProvider from "../lib/ai-provider.js";
import * as display from "../tui/display.js";
import * as modal from "../tui/modal.js";
import type { TuiState } from "../tui/state.js";
import { executeAction } from "./tui.js";

// Mock dependencies
vi.mock("../tui/display.js");
vi.mock("../tui/modal.js");
vi.mock("../lib/ai-provider.js");
vi.mock("../lib/config.js", () => ({
  loadAgentInstructions: () => "mock instructions",
  loadConfig: () => ({}),
  setRuntimeProvider: vi.fn(),
}));
vi.mock("../lib/prompts.js", () => ({
  buildImplementationPrompt: () => "mock prompt",
  buildCommitMessagePrompt: () => "mock commit prompt",
}));
vi.mock("../lib/progress.js", () => ({
  readProgress: () => "mock progress",
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

  it("returns false for quit action", async () => {
    const result = await executeAction("quit", mockState, mockDashboardLines);
    expect(result).toBe(false);
  });

  it("returns true for 'run' action after completion (no confirm needed)", async () => {
    // Mock AI invocation — no confirm dialog needed anymore
    vi.mocked(aiProvider.invokeAIInteractive).mockResolvedValue({
      // @ts-expect-error - minimal AI response for test
      result: Promise.resolve({} as any),
      provider: "claude",
    });

    const result = await executeAction("run", mockState, mockDashboardLines);

    expect(result).toBe(true);
    expect(aiProvider.invokeAIInteractive).toHaveBeenCalled();
    expect(display.clearScreen).toHaveBeenCalled();
  });

  it("returns true for 'pr' action (no confirm needed)", async () => {
    // prCommand is imported directly, mock it via the module
    const pr = await import("./pr.js");
    vi.spyOn(pr, "prCommand").mockResolvedValue();

    const result = await executeAction("pr", mockState, mockDashboardLines);

    expect(result).toBe(true);
    expect(display.clearScreen).toHaveBeenCalled();
  });

  it("returns true for 'create' action when cancelled via modal", async () => {
    vi.mocked(modal.showInput).mockResolvedValue(null);

    const result = await executeAction("create", mockState, mockDashboardLines);

    expect(result).toBe(true);
    expect(modal.showInput).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "New Ticket",
        label: "Describe the ticket:",
      })
    );
  });

  it("returns true for 'switch-provider' using modal select", async () => {
    vi.mocked(modal.showSelect).mockResolvedValue("gemini");

    const result = await executeAction("switch-provider", mockState, mockDashboardLines);

    expect(result).toBe(true);
    expect(modal.showSelect).toHaveBeenCalledWith(
      expect.objectContaining({ title: "AI Provider" })
    );
  });

  it("returns true for 'checkout-main' without confirm dialog", async () => {
    // Mock execa via the module
    const result = await executeAction("checkout-main", mockState, mockDashboardLines);

    expect(result).toBe(true);
    // showStatus should be called for the switching indicator
    expect(modal.showStatus).toHaveBeenCalledWith(
      "Switching",
      "Switching to main...",
      mockDashboardLines
    );
  });
});
