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

  // On main branch
  if (state.isOnMain) {
    actions.push({ id: "create", label: "new ticket", shortcut: "n" });
    actions.push({ id: "list", label: "list tickets", shortcut: "l" });
    actions.push({
      id: "switch-provider",
      label: "switch session provider",
      shortcut: "s",
    });
    actions.push({ id: "quit", label: "quit", shortcut: "q" });
    return actions;
  }

  // On feature branch - context-aware

  if (state.hasUncommittedChanges) {
    actions.push({ id: "commit", label: "commit", shortcut: "c" });
  }

  if (state.hasUnpushedCommits && state.commits.length > 0) {
    actions.push({ id: "push", label: "push", shortcut: "p" });
  }

  if (!state.pr && state.commits.length > 0) {
    actions.push({ id: "pr", label: "create PR", shortcut: "c" });
  }

  if (state.issue && state.pr?.state !== "merged") {
    actions.push({ id: "implement", label: "implement ticket", shortcut: "i" });
  }

  if (state.pr && state.pr.state === "open") {
    if (
      state.hasUIChanges &&
      state.isPlaywrightAvailable &&
      state.config.video.enabled
    ) {
      actions.push({ id: "video", label: "video playwright", shortcut: "v" });
    }
  }

  if (
    state.pr &&
    (state.pr.state === "merged" || state.pr.state === "closed")
  ) {
    actions.push({ id: "checkout-main", label: "main branch", shortcut: "m" });
  }

  actions.push({ id: "list", label: "list tickets", shortcut: "l" });
  actions.push({
    id: "switch-provider",
    label: "switch session provider",
    shortcut: "s",
  });
  actions.push({ id: "quit", label: "quit", shortcut: "q" });

  return actions;
}
