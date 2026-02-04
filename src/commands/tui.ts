import { execa } from "execa";
import { aggregateState, resetEnvCache, type TuiState } from "../tui/state.js";
import { getAvailableActions, type TuiAction } from "../tui/actions.js";
import {
  renderDashboard,
  buildDashboardLines,
  renderActionPanel,
  clearScreen,
} from "../tui/display.js";
import {
  showConfirm,
  showSelect,
  showInput,
  showMultilineInput,
  showStatus,
  showStatusWithSpinner,
  type SelectEntry,
} from "../tui/modal.js";
import { checkForUpdates, type VersionCheckResult } from "../lib/version.js";
import { logger } from "../utils/logger.js";
import { aiSpinnerText } from "../utils/spinner.js";
import { createCommand } from "./create.js";
import { initCommand } from "./init.js";
import { setupLabelsCommand } from "./setup-labels.js";
import { prCommand } from "./pr.js";
import { buildTicketChoices } from "./list.js";
import { githubRemoteCommand } from "./github-remote.js";
import {
  buildCommitMessagePrompt,
  buildImplementationPrompt,
} from "../lib/prompts.js";
import {
  invokeAI,
  invokeAIInteractive,
  getProviderDisplayName,
  getProviderEmail,
  isTimeoutError,
  AI_DEFAULT_TIMEOUT_MS,
} from "../lib/ai-provider.js";
import {
  loadAgentInstructions,
  loadConfig,
  setRuntimeProvider,
} from "../lib/config.js";
import { readProgress } from "../lib/progress.js";
import { listIssues, listOpenPrs } from "../lib/github.js";
import {
  getCurrentBranch,
  getDefaultBranch,
  hasUncommittedChanges,
  branchExists,
  checkoutBranch,
  createBranch,
  listLocalBranches,
  remoteBranchExists,
  fetchAndCheckout,
} from "../lib/git.js";
import { getWorkflowLabels, sortByPriority } from "../lib/labels.js";
import { generateBranchName } from "../lib/branch.js";
import type { AIProvider } from "../types/index.js";

const CANCEL = Symbol("cancel");

async function waitForKey(validKeys: string[]): Promise<string> {
  return new Promise((resolve) => {
    const { stdin } = process;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const onData = (key: string) => {
      // Handle Ctrl+C
      if (key === "\x03") {
        stdin.setRawMode(wasRaw ?? false);
        stdin.pause();
        stdin.removeListener("data", onData);
        resolve("q");
        return;
      }

      if (validKeys.includes(key)) {
        stdin.setRawMode(wasRaw ?? false);
        stdin.pause();
        stdin.removeListener("data", onData);
        resolve(key);
      }
    };

    stdin.on("data", onData);
  });
}

export interface ActionResult {
  running: boolean;
  refresh: boolean;
}

const CONTINUE: ActionResult = { running: true, refresh: true };
const SKIP_REFRESH: ActionResult = { running: true, refresh: false };
const QUIT: ActionResult = { running: false, refresh: false };

export async function executeAction(
  actionId: string,
  state: TuiState,
  dashboardLines: string[]
): Promise<ActionResult> {
  switch (actionId) {
    case "quit":
      return QUIT;

    case "list": {
      const switched = await handleList(dashboardLines);
      return switched ? CONTINUE : SKIP_REFRESH;
    }

    case "create": {
      const description = await showMultilineInput({
        title: "New Ticket",
        label: "Describe the ticket:",
        dashboardLines,
      });
      if (!description) return SKIP_REFRESH;

      clearScreen();
      try {
        await createCommand(description, {});
      } catch (error) {
        logger.error(`Create failed: ${error}`);
      }
      return CONTINUE;
    }

    case "commit": {
      const committed = await handleCommit(state, dashboardLines);
      return committed ? CONTINUE : SKIP_REFRESH;
    }

    case "push":
      await handlePush(dashboardLines);
      return CONTINUE;

    case "pr": {
      clearScreen();
      await prCommand({});
      return CONTINUE;
    }

    case "run": {
      await handleRun(state);
      return CONTINUE;
    }

    case "init": {
      clearScreen();
      try {
        await initCommand({});
      } catch (error) {
        logger.error(`Init failed: ${error}`);
      }
      resetEnvCache();
      return CONTINUE;
    }

    case "setup-labels": {
      clearScreen();
      try {
        await setupLabelsCommand();
      } catch (error) {
        logger.error(`Setup labels failed: ${error}`);
      }
      resetEnvCache();
      return CONTINUE;
    }

    case "github-remote": {
      const confirmed = await showConfirm({
        title: "Push to GitHub",
        message: "Create a private GitHub repo and push?",
        dashboardLines,
      });
      if (!confirmed) return SKIP_REFRESH;
      showStatus("Pushing", "Creating GitHub repo and pushing...", dashboardLines);
      await githubRemoteCommand();
      return CONTINUE;
    }

    case "switch-provider":
      await handleSwitchProvider(state, dashboardLines);
      return SKIP_REFRESH;

    case "refresh":
      return CONTINUE;

    default:
      return SKIP_REFRESH;
  }
}

/** Returns true if a commit was made. */
async function handleCommit(
  state: TuiState,
  dashboardLines: string[]
): Promise<boolean> {
  try {
    const { stdout: status } = await execa("git", ["status", "--short"]);
    if (!status.trim()) {
      showStatus("Commit", "No changes to commit", dashboardLines);
      await new Promise((r) => setTimeout(r, 1500));
      return false;
    }

    // Stage all changes
    await execa("git", ["add", "-A"]);

    // Get staged diff for AI commit message generation
    const { stdout: diffStat } = await execa("git", [
      "diff",
      "--cached",
      "--stat",
    ]);
    const { stdout: diffPatch } = await execa("git", ["diff", "--cached"]);
    const diffContent = (diffStat + "\n\n" + diffPatch).slice(0, 4000);

    const issueNumber = state.issue?.number ?? null;
    const issueTitle = state.issue?.title ?? null;
    const provider = state.config.ai.provider;
    const providerName = getProviderDisplayName(provider);

    // Modal select: AI or Manual
    const mode = await showSelect({
      title: "Commit",
      items: [
        { name: `Generate with ${providerName}`, value: "ai" },
        { name: "Enter manually", value: "manual" },
      ],
      dashboardLines,
    });

    if (!mode) {
      await execa("git", ["reset", "HEAD"]);
      return false;
    }

    let message: string | typeof CANCEL;

    if (mode === "manual") {
      const input = await showInput({
        title: "Commit Message",
        label: "Enter commit message:",
        dashboardLines,
      });
      message = input || CANCEL;
    } else {
      // Show animated spinner while generating
      const spinner = showStatusWithSpinner(
        "Generating",
        aiSpinnerText(providerName, "generate commit message"),
        dashboardLines
      );
      try {
        message = await generateCommitMessage(
          diffContent,
          issueNumber,
          issueTitle,
          state,
          dashboardLines
        );
      } finally {
        spinner.stop();
      }
    }

    if (message === CANCEL) {
      await execa("git", ["reset", "HEAD"]);
      return false;
    }

    // Confirm commit with generated message
    const confirmed = await showConfirm({
      title: "Commit",
      message: `Message: ${message.length > 50 ? message.slice(0, 50) + "…" : message}`,
      dashboardLines,
    });

    if (!confirmed) {
      await execa("git", ["reset", "HEAD"]);
      return false;
    }

    const providerEmail = getProviderEmail(provider);
    const fullMessage = `${message}\n\nCo-Authored-By: ${providerName} <${providerEmail}>`;

    showStatus("Committing", "Committing changes...", dashboardLines);
    await execa("git", ["commit", "-m", fullMessage]);
    return true;
  } catch (error) {
    logger.error(`Commit failed: ${error}`);
    return false;
  }
}

async function generateCommitMessage(
  diffContent: string,
  issueNumber: number | null,
  issueTitle: string | null,
  state: TuiState,
  dashboardLines: string[]
): Promise<string | typeof CANCEL> {
  try {
    const prompt = buildCommitMessagePrompt(
      diffContent,
      issueNumber,
      issueTitle
    );
    const result = await invokeAI(
      { prompt, streamOutput: false, timeout: AI_DEFAULT_TIMEOUT_MS },
      state.config
    );
    let message = result.output.trim().split("\n")[0].trim();
    // Strip wrapping quotes, backticks, or code fences
    for (const q of ['"', "'", "`"]) {
      if (message.startsWith(q) && message.endsWith(q)) {
        message = message.slice(1, -1);
        break;
      }
    }
    message = message.replace(/^```\w*\s*/, "").replace(/\s*```$/, "");
    return message;
  } catch (error) {
    // Provide specific feedback for timeout vs other errors
    const errorLabel = isTimeoutError(error)
      ? "AI generation timed out. Enter commit message:"
      : "AI generation failed. Enter commit message:";

    const input = await showInput({
      title: "Commit Message",
      label: errorLabel,
      dashboardLines,
    });
    return input || CANCEL;
  }
}

async function handleRun(state: TuiState): Promise<void> {
  if (!state.issue) {
    logger.error("No linked issue found");
    return;
  }

  const agentInstructions = loadAgentInstructions();
  const progressContent = readProgress(state.config);

  // Build context based on current state
  const contextParts: string[] = [];

  if (state.commits.length > 0) {
    contextParts.push(
      `## Current Progress\nThere are ${state.commits.length} existing commit(s) on this branch:\n${state.commits.map((c) => `- ${c}`).join("\n")}\n\nContinue the implementation from where it left off. Review the existing work and complete any remaining tasks.`
    );
  }

  if (state.hasActionableFeedback && state.reviewFeedback.length > 0) {
    const feedbackLines = state.reviewFeedback
      .map((f) => `- [${f.source}] ${f.body.slice(0, 200)}`)
      .join("\n");
    contextParts.push(`## Review Feedback\n${feedbackLines}`);
  }

  const extraContext =
    contextParts.length > 0 ? contextParts.join("\n\n") : null;

  const prompt = buildImplementationPrompt(
    state.issue,
    agentInstructions,
    progressContent,
    state.config,
    extraContext
  );

  const providerName = getProviderDisplayName(state.config.ai.provider);

  clearScreen();
  renderActionPanel(`${providerName} Session`, [
    `Implementing: #${state.issue.number} ${state.issue.title}`,
    state.commits.length > 0
      ? `Continuing from ${state.commits.length} existing commit(s)`
      : "Starting fresh implementation",
    ...(state.hasActionableFeedback
      ? [`Includes ${state.reviewFeedback.length} review feedback item(s)`]
      : []),
  ]);
  console.log();

  try {
    const { result } = await invokeAIInteractive(prompt, state.config);
    await result;
  } catch (error) {
    logger.error(`${providerName} session failed: ${error}`);
  }
}

async function handlePush(dashboardLines: string[]): Promise<void> {
  try {
    const { stdout: branch } = await execa("git", ["branch", "--show-current"]);
    const branchName = branch.trim();

    showStatus("Pushing", `Pushing ${branchName} to remote...`, dashboardLines);
    await execa("git", ["push", "-u", "origin", branchName]);
  } catch (error) {
    logger.error(`Push failed: ${error}`);
  }
}

const PROVIDERS: AIProvider[] = ["claude", "gemini", "codex"];

async function handleSwitchProvider(
  state: TuiState,
  dashboardLines: string[]
): Promise<void> {
  const current = state.config.ai.provider;
  const items = PROVIDERS.map((p) => ({
    name:
      p.charAt(0).toUpperCase() +
      p.slice(1) +
      (p === current ? " (current)" : ""),
    value: p,
  }));

  const provider = await showSelect({
    title: "AI Provider",
    items,
    dashboardLines,
  });

  if (!provider || provider === current) return;

  setRuntimeProvider(provider as AIProvider);
  // Update in-memory state so dashboard re-renders with new provider
  state.config.ai.provider = provider as AIProvider;
}

/** Returns true if a branch switch occurred. */
async function handleList(
  dashboardLines: string[]
): Promise<boolean> {
  try {
    showStatus("Loading", "Fetching tickets...", dashboardLines);

    const config = loadConfig();
    const workflowLabels = getWorkflowLabels(config);

    const [inProgress, ready, prs, localBranches, dirty] = await Promise.all([
      listIssues({
        labels: [workflowLabels.inProgress],
        state: "open",
        limit: 20,
      }),
      listIssues({
        labels: [workflowLabels.ready],
        state: "open",
        limit: 20,
      }),
      listOpenPrs(30),
      listLocalBranches(),
      hasUncommittedChanges(),
    ]);

    sortByPriority(inProgress);
    sortByPriority(ready);

    const choices = buildTicketChoices(inProgress, ready, prs, localBranches);
    const currentBranch = await getCurrentBranch();
    const defaultBranch = await getDefaultBranch();

    // Build modal select entries with category separators
    const items: SelectEntry[] = [];
    let initialIndex = 0;
    let selectableIdx = 0;

    // Main branch option
    const isMain = currentBranch === defaultBranch;
    const mainLabel = defaultBranch + (isMain ? " (current)" : "");

    if (dirty && !isMain) {
      items.push({
        name: `${mainLabel} (disabled - uncommitted changes)`,
        value: "__main_disabled__",
      });
    } else {
      items.push({ name: mainLabel, value: "__main__" });
    }
    if (isMain) initialIndex = selectableIdx;
    selectableIdx++;

    const inProgressChoices = choices.filter(
      (c) => c.category === "in-progress"
    );
    const openPrChoices = choices.filter((c) => c.category === "open-pr");
    const readyChoices = choices.filter((c) => c.category === "ready");

    const addChoices = (list: typeof choices) => {
      for (const c of list) {
        const isCurrent = c.branch === currentBranch;
        items.push({
          name: `#${c.issueNumber} ${c.title}`,
          value: String(c.issueNumber),
        });
        if (isCurrent) initialIndex = selectableIdx;
        selectableIdx++;
      }
    };

    if (inProgressChoices.length > 0) {
      items.push({ separator: "── In Progress ──" });
      addChoices(inProgressChoices);
    }
    if (openPrChoices.length > 0) {
      items.push({ separator: "── Open PRs ──" });
      addChoices(openPrChoices);
    }
    if (readyChoices.length > 0) {
      items.push({ separator: "── Ready ──" });
      addChoices(readyChoices);
    }

    const selected = await showSelect({
      title: "Switch Ticket",
      items,
      dashboardLines,
      initialIndex,
      currentIndex: initialIndex,
    });

    if (!selected) return false;

    // Handle disabled main
    if (selected === "__main_disabled__") {
      showStatus(
        "Uncommitted Changes",
        "Commit or stash changes before switching to main",
        dashboardLines
      );
      await new Promise((r) => setTimeout(r, 2000));
      return false;
    }

    // Handle main branch selection
    if (selected === "__main__") {
      if (currentBranch === defaultBranch) return false;
      showStatus("Switching", `Switching to ${defaultBranch}...`, dashboardLines);
      await checkoutBranch(defaultBranch);
      return true;
    }

    // Find selected ticket
    const issueNumber = parseInt(selected, 10);
    const ticket = choices.find((c) => c.issueNumber === issueNumber);
    if (!ticket) return false;

    if (dirty) {
      const ok = await showConfirm({
        title: "Uncommitted Changes",
        message: "You have uncommitted changes. Continue?",
        dashboardLines,
      });
      if (!ok) return false;
    }

    const targetBranch = ticket.branch;

    if (targetBranch) {
      if (await branchExists(targetBranch)) {
        showStatus("Switching", `Switching to ${targetBranch}...`, dashboardLines);
        await checkoutBranch(targetBranch);
        return true;
      } else if (await remoteBranchExists(targetBranch)) {
        showStatus("Fetching", `Fetching ${targetBranch}...`, dashboardLines);
        await fetchAndCheckout(targetBranch);
        return true;
      } else {
        return await offerCreateBranch(
          issueNumber,
          ticket.title,
          dashboardLines
        );
      }
    } else {
      return await offerCreateBranch(
        issueNumber,
        ticket.title,
        dashboardLines
      );
    }
  } catch (error) {
    logger.error(`List failed: ${error}`);
    return false;
  }
}

/** Returns true if a branch was created. */
async function offerCreateBranch(
  issueNumber: number,
  title: string,
  dashboardLines: string[]
): Promise<boolean> {
  const config = loadConfig();
  const branchName = await generateBranchName(
    config,
    issueNumber,
    title,
    "feature"
  );

  const create = await showConfirm({
    title: "Create Branch",
    message: `No branch found. Create ${branchName}?`,
    dashboardLines,
  });

  if (!create) return false;

  const defaultBranch = await getDefaultBranch();
  showStatus("Creating", `Creating ${branchName}...`, dashboardLines);
  await createBranch(branchName, defaultBranch);
  return true;
}

const VERSION_CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export async function tuiCommand(): Promise<void> {
  let running = true;
  let lastActions: TuiAction[] = [];
  let lastDashboardLines: string[] = [];
  let versionCheck: VersionCheckResult | null = null;

  // Initial placeholder state for the first "Loading..." render
  const config = loadConfig();
  let lastState: TuiState = {
    isGitRepo: true,
    isGhAuthenticated: true,
    isAIProviderAvailable: true,
    config,
    hasConfig: true,
    hasProgress: false,
    branch: "",
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
    hasLabels: true,
  };

  let needsRefresh = true;
  let isFirstLoad = true;

  while (running) {
    if (needsRefresh) {
      // Show dashboard with refreshing indicator while loading new state
      clearScreen();
      renderDashboard(lastState, lastActions, undefined, true, versionCheck);

      // Fire version check in parallel with state aggregation (non-blocking)
      // Force a fresh check on first load (interval=0), then throttle subsequent checks
      const checkInterval = isFirstLoad ? 0 : VERSION_CHECK_INTERVAL_MS;
      isFirstLoad = false;
      const [state, versionResult] = await Promise.all([
        aggregateState(),
        checkForUpdates(checkInterval).catch(() => null),
      ]);
      const actions = getAvailableActions(state);

      // Save for next refresh cycle
      lastState = state;
      lastActions = actions;
      if (versionResult) versionCheck = versionResult;
    }

    // Contextual hint
    let hint: string | undefined;
    if (lastState.isOnMain) {
      hint = "Select an action to get started";
    } else if (lastState.hasUncommittedChanges && !lastState.pr) {
      hint = "Commit your changes before creating a PR";
    } else if (lastState.hasActionableFeedback) {
      hint = "Review feedback needs attention";
    }

    // Build and render dashboard, capturing lines for modal overlays
    lastDashboardLines = buildDashboardLines(lastState, lastActions, hint, false, versionCheck);
    clearScreen();
    for (const line of lastDashboardLines) {
      console.log(line);
    }

    // Wait for a valid keypress
    const validKeys = lastActions.map((a) => a.shortcut);
    const key = await waitForKey(validKeys);

    // Find the matching action
    const action = lastActions.find((a) => a.shortcut === key);
    if (action) {
      const result = await executeAction(action.id, lastState, lastDashboardLines);
      running = result.running;
      needsRefresh = result.refresh;
    }
  }
}
