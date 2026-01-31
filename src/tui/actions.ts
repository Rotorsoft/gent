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

  // Common actions available everywhere
  actions.push({ id: "create", label: "new", shortcut: "n" });

  // On feature branch - add context-aware actions BEFORE other common actions
  if (!state.isOnMain) {
    if (state.hasUncommittedChanges) {
      actions.push({ id: "commit", label: "commit", shortcut: "c" });
    }

    if (state.hasUnpushedCommits && state.commits.length > 0) {
      actions.push({ id: "push", label: "push", shortcut: "s" });
    }

    if (!state.pr && state.commits.length > 0) {
      actions.push({ id: "pr", label: "pr", shortcut: "p" });
    }

    if (state.issue && state.pr?.state !== "merged") {
      actions.push({ id: "run", label: "run", shortcut: "r" });
    }
  }

  // Common navigation/config actions
  actions.push({ id: "list", label: "list", shortcut: "l" });
  actions.push({ id: "refresh", label: "refresh", shortcut: "f" });
  actions.push({ id: "switch-provider", label: "ai", shortcut: "a" });
  actions.push({ id: "quit", label: "quit", shortcut: "q" });

  return actions;
}
