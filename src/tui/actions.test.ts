import { describe, expect, it } from "vitest";
import { getAvailableActions } from "./actions.js";
import type { TuiState } from "./state.js";

function createBaseState(overrides: Partial<TuiState> = {}): TuiState {
  return {
    isGitRepo: true,
    isGhAuthenticated: true,
    isAIProviderAvailable: true,
    config: {
      version: 1,
      github: {
        labels: {
          workflow: {
            ready: "ai-ready",
            in_progress: "ai-in-progress",
            completed: "ai-completed",
            blocked: "ai-blocked",
          },
          types: ["feature"],
          priorities: ["high"],
          risks: ["low"],
          areas: ["ui"],
        },
      },
      branch: {
        pattern: "{author}/{type}-{issue}-{slug}",
        author_source: "git",
        author_env_var: "GENT_AUTHOR",
      },
      progress: {
        file: "progress.txt",
        archive_threshold: 500,
        archive_dir: ".gent/archive",
      },
      ai: { provider: "claude", auto_fallback: false },
      video: { enabled: true, max_duration: 30, width: 1280, height: 720 },
      validation: [],
      claude: { permission_mode: "default", agent_file: "AGENT.md" },
      gemini: { sandbox_mode: "default", agent_file: "AGENT.md" },
      codex: { agent_file: "AGENT.md" },
    },
    hasConfig: true,
    hasProgress: true,
    branch: "main",
    branchInfo: null,
    isOnMain: true,
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
    ...overrides,
  };
}

describe("getAvailableActions", () => {
  it("shows only quit when not a git repo", () => {
    const actions = getAvailableActions(createBaseState({ isGitRepo: false }));
    expect(actions).toHaveLength(1);
    expect(actions[0].id).toBe("quit");
  });

  it("shows only quit when not authenticated", () => {
    const actions = getAvailableActions(
      createBaseState({ isGhAuthenticated: false })
    );
    expect(actions).toHaveLength(1);
    expect(actions[0].id).toBe("quit");
  });

  it("shows main branch actions with shortcuts", () => {
    const actions = getAvailableActions(createBaseState());
    const ids = actions.map((a) => a.id);

    expect(ids).toHaveLength(5);
    expect(ids).toContain("create");
    expect(ids).toContain("list");
    expect(ids).toContain("refresh");
    expect(ids).toContain("switch-provider");
    expect(ids).toContain("quit");

    // Each action has a shortcut
    for (const action of actions) {
      expect(action.shortcut).toBeTruthy();
    }
  });

  it("includes refresh with 'f' shortcut", () => {
    const actions = getAvailableActions(createBaseState());
    const refresh = actions.find((a) => a.id === "refresh");
    expect(refresh).toBeDefined();
    expect(refresh!.shortcut).toBe("f");
  });

  it("shows commit when uncommitted changes on feature branch", () => {
    const actions = getAvailableActions(
      createBaseState({
        isOnMain: false,
        branch: "ro/feature-123-test",
        hasUncommittedChanges: true,
        commits: ["feat: test"],
      })
    );
    const ids = actions.map((a) => a.id);

    expect(ids).toContain("commit");
  });

  it("shows push with 's' shortcut when unpushed commits exist", () => {
    const actions = getAvailableActions(
      createBaseState({
        isOnMain: false,
        branch: "ro/feature-123-test",
        hasUnpushedCommits: true,
        commits: ["feat: test"],
      })
    );
    const push = actions.find((a) => a.id === "push");

    expect(push).toBeDefined();
    expect(push!.shortcut).toBe("s");
  });

  it("shows both commit and push when uncommitted and unpushed exist", () => {
    const actions = getAvailableActions(
      createBaseState({
        isOnMain: false,
        branch: "ro/feature-123-test",
        hasUncommittedChanges: true,
        hasUnpushedCommits: true,
        commits: ["feat: test"],
      })
    );
    const ids = actions.map((a) => a.id);

    expect(ids).toContain("push");
    expect(ids).toContain("commit");
  });

  it("shows create pr with 'p' shortcut when no PR exists but commits do", () => {
    const actions = getAvailableActions(
      createBaseState({
        isOnMain: false,
        branch: "ro/feature-123-test",
        commits: ["feat: test"],
      })
    );
    const pr = actions.find((a) => a.id === "pr");

    expect(pr).toBeDefined();
    expect(pr!.shortcut).toBe("p");
  });

  it("shows run when issue exists on feature branch", () => {
    const actions = getAvailableActions(
      createBaseState({
        isOnMain: false,
        branch: "ro/feature-123-test",
        issue: {
          number: 123,
          title: "Test",
          body: "Desc",
          labels: ["ai-in-progress"],
          state: "open",
          url: "https://github.com/test/repo/issues/123",
        },
      })
    );
    const ids = actions.map((a) => a.id);

    expect(ids).toContain("run");
  });

  it("uses 'r' shortcut for run action", () => {
    const actions = getAvailableActions(
      createBaseState({
        isOnMain: false,
        branch: "ro/feature-123-test",
        issue: {
          number: 123,
          title: "Test",
          body: "Desc",
          labels: ["ai-in-progress"],
          state: "open",
          url: "https://github.com/test/repo/issues/123",
        },
      })
    );
    const impl = actions.find((a) => a.id === "run");

    expect(impl).toBeDefined();
    expect(impl!.shortcut).toBe("r");
  });

  it("does not show video action", () => {
    const actions = getAvailableActions(
      createBaseState({
        isOnMain: false,
        branch: "ro/feature-123-test",
        pr: {
          number: 456,
          title: "Test PR",
          url: "https://github.com/test/repo/pull/456",
          state: "open",
          reviewDecision: null,
          isDraft: false,
        },
        hasUIChanges: true,
        isPlaywrightAvailable: true,
      })
    );
    const ids = actions.map((a) => a.id);

    expect(ids).not.toContain("video");
  });

  it("does not show run when PR is merged", () => {
    const actions = getAvailableActions(
      createBaseState({
        isOnMain: false,
        branch: "ro/feature-123-test",
        issue: {
          number: 123,
          title: "Test",
          body: "Desc",
          labels: ["ai-completed"],
          state: "open",
          url: "https://github.com/test/repo/issues/123",
        },
        pr: {
          number: 456,
          title: "Test PR",
          url: "https://github.com/test/repo/pull/456",
          state: "merged",
          reviewDecision: null,
          isDraft: false,
        },
      })
    );
    const ids = actions.map((a) => a.id);

    expect(ids).not.toContain("run");
  });

  it("shows run when PR is open", () => {
    const actions = getAvailableActions(
      createBaseState({
        isOnMain: false,
        branch: "ro/feature-123-test",
        issue: {
          number: 123,
          title: "Test",
          body: "Desc",
          labels: ["ai-in-progress"],
          state: "open",
          url: "https://github.com/test/repo/issues/123",
        },
        pr: {
          number: 456,
          title: "Test PR",
          url: "https://github.com/test/repo/pull/456",
          state: "open",
          reviewDecision: null,
          isDraft: false,
        },
      })
    );
    const ids = actions.map((a) => a.id);

    expect(ids).toContain("run");
  });

  it("does not show run without issue on feature branch", () => {
    const actions = getAvailableActions(
      createBaseState({
        isOnMain: false,
        branch: "ro/feature-123-test",
        issue: null,
      })
    );
    const ids = actions.map((a) => a.id);

    expect(ids).not.toContain("run");
  });

  it("does not show push without commits even when unpushed flag is set", () => {
    const actions = getAvailableActions(
      createBaseState({
        isOnMain: false,
        branch: "ro/feature-123-test",
        hasUnpushedCommits: true,
        commits: [],
      })
    );
    const ids = actions.map((a) => a.id);

    expect(ids).not.toContain("push");
  });

  it("always includes quit on feature branch", () => {
    const actions = getAvailableActions(
      createBaseState({
        isOnMain: false,
        branch: "ro/feature-123-test",
      })
    );
    const ids = actions.map((a) => a.id);

    expect(ids).toContain("quit");
  });

  it("hides create and pr actions when hasValidRemote is false", () => {
    const actions = getAvailableActions(
      createBaseState({
        hasValidRemote: false,
        isOnMain: false,
        branch: "ro/feature-123-test",
        commits: ["feat: test"],
      })
    );
    const ids = actions.map((a) => a.id);

    expect(ids).not.toContain("create");
    expect(ids).not.toContain("pr");
    // Other actions should still be present
    expect(ids).toContain("list");
    expect(ids).toContain("refresh");
    expect(ids).toContain("quit");
  });

  it("shows create and pr actions when hasValidRemote is true", () => {
    const actions = getAvailableActions(
      createBaseState({
        hasValidRemote: true,
        isOnMain: false,
        branch: "ro/feature-123-test",
        commits: ["feat: test"],
      })
    );
    const ids = actions.map((a) => a.id);

    expect(ids).toContain("create");
    expect(ids).toContain("pr");
  });

  it("has unique shortcuts per action set", () => {
    const state = createBaseState({
      isOnMain: false,
      branch: "ro/feature-123-test",
      hasUncommittedChanges: true,
      commits: ["feat: test"],
      issue: {
        number: 123,
        title: "Test",
        body: "Desc",
        labels: ["ai-in-progress"],
        state: "open",
        url: "https://github.com/test/repo/issues/123",
      },
      workflowStatus: "in-progress",
    });
    const actions = getAvailableActions(state);
    const shortcuts = actions.map((a) => a.shortcut);
    const unique = new Set(shortcuts);
    expect(unique.size).toBe(shortcuts.length);
  });
});
