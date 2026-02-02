import type { TuiState } from "./state.js";

export interface TuiAction {
  id: string;
  label: string;
  shortcut: string;
}

export function getAvailableActions(state: TuiState): TuiAction[] {
  const actions: TuiAction[] = [];

  if (!state.isGitRepo || !state.isGhAuthenticated) {
    actions.push({ id: "quit", label: "quit", shortcut: "q" });
    return actions;
  }

  // Setup actions when prerequisites are missing
  const needsInit = !state.hasConfig;
  const needsLabels = state.hasConfig && state.hasValidRemote && !state.hasLabels;

  if (needsInit) {
    actions.push({ id: "init", label: "init", shortcut: "i" });
  } else if (needsLabels) {
    actions.push({ id: "setup-labels", label: "setup-labels", shortcut: "b" });
  }

  // Only show workflow actions when fully set up
  const isSetUp = state.hasConfig && (!state.hasValidRemote || state.hasLabels);

  // Common actions available everywhere (gated on valid remote for GitHub-dependent actions)
  if (isSetUp && state.hasValidRemote) {
    actions.push({ id: "create", label: "new", shortcut: "n" });
  }

  // On feature branch - add context-aware actions BEFORE other common actions
  if (!state.isOnMain) {
    if (state.hasUncommittedChanges) {
      actions.push({ id: "commit", label: "commit", shortcut: "c" });
    }

    if (state.hasUnpushedCommits && state.commits.length > 0) {
      actions.push({ id: "push", label: "push", shortcut: "s" });
    }

    if (isSetUp && state.hasValidRemote && !state.pr && state.commits.length > 0) {
      actions.push({ id: "pr", label: "pr", shortcut: "p" });
    }

    if (isSetUp && state.issue && state.pr?.state !== "merged") {
      actions.push({ id: "run", label: "run", shortcut: "r" });
    }
  }

  // Common navigation/config actions
  if (isSetUp && state.hasValidRemote) {
    actions.push({ id: "list", label: "list", shortcut: "l" });
  } else if (!state.hasValidRemote) {
    actions.push({ id: "github-remote", label: "github", shortcut: "g" });
  }
  actions.push({ id: "refresh", label: "refresh", shortcut: "f" });
  actions.push({ id: "switch-provider", label: "ai", shortcut: "a" });
  actions.push({ id: "quit", label: "quit", shortcut: "q" });

  return actions;
}
