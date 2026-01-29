import inquirer from "inquirer";
import { execa } from "execa";
import { aggregateState, type TuiState } from "../tui/state.js";
import { getAvailableActions, type TuiAction } from "../tui/actions.js";
import {
  renderDashboard,
  renderActionPanel,
  clearScreen,
} from "../tui/display.js";
import { logger } from "../utils/logger.js";
import { createSpinner } from "../utils/spinner.js";
import { createCommand } from "./create.js";
import { prCommand } from "./pr.js";
import { listCommand } from "./list.js";
import {
  buildCommitMessagePrompt,
  buildImplementationPrompt,
} from "../lib/prompts.js";
import {
  invokeAI,
  invokeAIInteractive,
  getProviderDisplayName,
  getProviderEmail,
} from "../lib/ai-provider.js";
import {
  loadAgentInstructions,
  loadConfig,
  setRuntimeProvider,
} from "../lib/config.js";
import { readProgress } from "../lib/progress.js";
import type { AIProvider } from "../types/index.js";

const CANCEL = Symbol("cancel");

async function confirm(message: string): Promise<boolean> {
  const { ok } = await inquirer.prompt<{ ok: boolean }>([
    {
      type: "confirm",
      name: "ok",
      message,
      default: true,
    },
  ]);
  return ok;
}

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

export async function executeAction(
  actionId: string,
  state: TuiState
): Promise<boolean> {
  switch (actionId) {
    case "quit":
      return false;

    case "list": {
      clearScreen();
      try {
        await listCommand({});
      } catch (error) {
        logger.error(`List failed: ${error}`);
      }
      await promptContinue();
      return true;
    }

    case "create": {
      clearScreen();
      const { description } = await inquirer.prompt<{ description: string }>([
        {
          type: "input",
          name: "description",
          message: "Describe the ticket (empty to cancel):",
        },
      ]);
      if (!description.trim()) {
        logger.info("Cancelled");
        return true;
      }
      try {
        await createCommand(description, {});
      } catch (error) {
        logger.error(`Create failed: ${error}`);
      }
      await promptContinue();
      return true;
    }

    case "commit":
      clearScreen();
      await handleCommit(state);
      await promptContinue();
      return true;

    case "push":
      clearScreen();
      await handlePush();
      await promptContinue();
      return true;

    case "pr": {
      clearScreen();
      if (!(await confirm("Create a pull request?"))) return true;
      await prCommand({});
      await promptContinue();
      return true;
    }

    case "run": {
      clearScreen();
      const hasCommits = state.commits.length > 0;
      const hasFeedback = state.hasActionableFeedback;
      let msg: string;
      if (hasFeedback && hasCommits) {
        msg = "Start AI agent to address review feedback?";
      } else if (hasCommits) {
        msg =
          "Start AI agent to continue implementation from existing commits?";
      } else {
        msg = "Start AI agent to implement this ticket from scratch?";
      }
      if (!(await confirm(msg))) return true;
      await handleRun(state);
      await promptContinue();
      return true;
    }

    case "switch-provider":
      clearScreen();
      await handleSwitchProvider(state);
      return true;

    case "checkout-main": {
      clearScreen();
      if (!(await confirm("Switch to main branch?"))) return true;
      await handleCheckoutMain();
      return true;
    }

    default:
      return true;
  }
}

async function handleCommit(state: TuiState): Promise<void> {
  try {
    const { stdout: status } = await execa("git", ["status", "--short"]);
    if (!status.trim()) {
      logger.info("No changes to commit");
      return;
    }

    logger.info("Changes:");
    console.log(status);
    console.log();

    // Stage all changes first so we can get a clean cached diff
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

    const { mode } = await inquirer.prompt<{ mode: "ai" | "manual" }>([
      {
        type: "list",
        name: "mode",
        message: "How would you like to provide the commit message?",
        choices: [
          { name: `Generate with ${providerName}`, value: "ai" },
          { name: "Enter manually", value: "manual" },
        ],
      },
    ]);

    let message: string | typeof CANCEL;

    if (mode === "manual") {
      const { manualInput } = await inquirer.prompt<{ manualInput: string }>([
        {
          type: "input",
          name: "manualInput",
          message: "Commit message (empty to cancel):",
        },
      ]);
      message = manualInput.trim() || CANCEL;
    } else {
      logger.info(`Generating commit message with ${providerName}...`);
      message = await generateCommitMessage(
        diffContent,
        issueNumber,
        issueTitle,
        state
      );
    }
    if (message === CANCEL) {
      await execa("git", ["reset", "HEAD"]);
      logger.info("Cancelled");
      return;
    }

    console.log();
    logger.info(`Message: ${message}`);
    console.log();

    if (!(await confirm("Commit with this message?"))) {
      await execa("git", ["reset", "HEAD"]);
      logger.info("Commit cancelled");
      return;
    }

    const providerEmail = getProviderEmail(provider);
    const fullMessage = `${message}\n\nCo-Authored-By: ${providerName} <${providerEmail}>`;

    const spinner = createSpinner("Committing...");
    spinner.start();
    await execa("git", ["commit", "-m", fullMessage]);
    spinner.succeed("Changes committed");
  } catch (error) {
    logger.error(`Commit failed: ${error}`);
  }
}

async function generateCommitMessage(
  diffContent: string,
  issueNumber: number | null,
  issueTitle: string | null,
  state: TuiState
): Promise<string | typeof CANCEL> {
  try {
    const prompt = buildCommitMessagePrompt(
      diffContent,
      issueNumber,
      issueTitle
    );
    const result = await invokeAI({ prompt, streamOutput: true }, state.config);
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
  } catch {
    logger.warning("AI commit message generation failed");
    console.log();
    const { message } = await inquirer.prompt<{ message: string }>([
      {
        type: "input",
        name: "message",
        message: "Commit message (empty to cancel):",
      },
    ]);
    return message.trim() || CANCEL;
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

async function handlePush(): Promise<void> {
  try {
    const { stdout: branch } = await execa("git", ["branch", "--show-current"]);
    if (!(await confirm(`Push ${branch.trim()} to remote?`))) return;

    const spinner = createSpinner("Pushing...");
    spinner.start();
    await execa("git", ["push", "-u", "origin", branch.trim()]);
    spinner.succeed("Pushed to remote");
  } catch (error) {
    logger.error(`Push failed: ${error}`);
  }
}

const PROVIDERS: AIProvider[] = ["claude", "gemini", "codex"];

async function handleSwitchProvider(state: TuiState): Promise<void> {
  const current = state.config.ai.provider;
  const { provider } = await inquirer.prompt<{ provider: AIProvider }>([
    {
      type: "list",
      name: "provider",
      message: "Select AI provider:",
      choices: PROVIDERS.map((p) => ({
        name:
          p.charAt(0).toUpperCase() +
          p.slice(1) +
          (p === current ? " (current)" : ""),
        value: p,
      })),
      default: current,
    },
  ]);

  if (provider === current) return;

  setRuntimeProvider(provider);
  logger.success(`Provider switched to ${provider} (session only)`);
}

async function handleCheckoutMain(): Promise<void> {
  try {
    const spinner = createSpinner("Switching to main...");
    spinner.start();
    await execa("git", ["checkout", "main"]);
    await execa("git", ["pull"]);
    spinner.succeed("Switched to main");
  } catch (error) {
    logger.error(`Checkout failed: ${error}`);
  }
}

async function promptContinue(): Promise<void> {
  console.log();
  await inquirer.prompt([
    {
      type: "input",
      name: "continue",
      message: "Press Enter to continue...",
    },
  ]);
}

export async function tuiCommand(): Promise<void> {
  let running = true;
  let lastActions: TuiAction[] = [];

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
  };

  while (running) {
    // Show dashboard with refreshing indicator while loading new state
    clearScreen();
    renderDashboard(lastState, lastActions, undefined, true);

    const state = await aggregateState();

    const actions = getAvailableActions(state);

    // Save for next refresh cycle
    lastState = state;
    lastActions = actions;

    clearScreen();

    // Contextual hint
    let hint: string | undefined;
    if (state.isOnMain) {
      hint = "Select an action to get started";
    } else if (state.hasUncommittedChanges && !state.pr) {
      hint = "Commit your changes before creating a PR";
    } else if (state.hasActionableFeedback) {
      hint = "Review feedback needs attention";
    }

    renderDashboard(state, actions, hint);

    // Wait for a valid keypress
    const validKeys = actions.map((a) => a.shortcut);
    const key = await waitForKey(validKeys);

    // Find the matching action
    const action = actions.find((a) => a.shortcut === key);
    if (action) {
      running = await executeAction(action.id, state);
    }
  }
}
