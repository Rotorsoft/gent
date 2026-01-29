import inquirer from "inquirer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as aiProvider from "../lib/ai-provider.js";
import * as display from "../tui/display.js";
import type { TuiState } from "../tui/state.js";
import { executeAction } from "./tui.js";

// Mock dependencies
vi.mock("inquirer");
vi.mock("../tui/display.js");
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

  it("returns true for 'run' action after completion", async () => {
    // Mock inquirer for confirm ("Start AI agent...?") and promptContinue ("Press Enter...")
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ ok: true }) // confirm
      .mockResolvedValueOnce({ continue: "" }); // promptContinue

    // Mock AI invocation
    vi.mocked(aiProvider.invokeAIInteractive).mockResolvedValue({
      // @ts-expect-error - minimal AI response for test
      result: Promise.resolve({} as any),
      provider: "claude",
    });

    const result = await executeAction("run", mockState);

    expect(result).toBe(true);
    expect(inquirer.prompt).toHaveBeenCalledTimes(2);
    expect(aiProvider.invokeAIInteractive).toHaveBeenCalled();
    expect(display.clearScreen).toHaveBeenCalled();
  });

  it("returns true for 'run' action if cancelled by user confirmation", async () => {
    // Mock inquirer for confirm to return false
    vi.mocked(inquirer.prompt).mockResolvedValueOnce({ ok: false });

    const result = await executeAction("run", mockState);

    expect(result).toBe(true);
    expect(inquirer.prompt).toHaveBeenCalledTimes(1);
    expect(aiProvider.invokeAIInteractive).not.toHaveBeenCalled();
  });
});
