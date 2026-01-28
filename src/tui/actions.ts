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
    actions.push({ id: "run-auto", label: "implement next", shortcut: "r" });
    actions.push({ id: "list", label: "list issues", shortcut: "l" });
    actions.push({ id: "quit", label: "quit", shortcut: "q" });
    return actions;
  }

  // On feature branch - context-aware

  if (state.hasUncommittedChanges) {
    actions.push({ id: "commit", label: "commit", shortcut: "c" });
  }

  if (state.hasUnpushedCommits && !state.hasUncommittedChanges) {
    actions.push({ id: "push", label: "push", shortcut: "p" });
  }

  if (!state.pr && state.commits.length > 0) {
    actions.push({ id: "pr", label: "create pr", shortcut: "p" });
  }

  if (state.pr && state.pr.state === "open") {
    if (state.hasActionableFeedback) {
      actions.push({ id: "fix", label: "fix feedback", shortcut: "f" });
    }

    if (state.hasUIChanges && state.isPlaywrightAvailable && state.config.video.enabled) {
      actions.push({ id: "video", label: "record video", shortcut: "v" });
    }
  }

  if (state.pr && (state.pr.state === "merged" || state.pr.state === "closed")) {
    actions.push({ id: "checkout-main", label: "back to main", shortcut: "m" });
  }

  actions.push({ id: "quit", label: "quit", shortcut: "q" });

  return actions;
}
