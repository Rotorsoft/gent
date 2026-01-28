import inquirer from "inquirer";
import { execa } from "execa";
import { aggregateState, type TuiState } from "../tui/state.js";
import { getAvailableActions } from "../tui/actions.js";
import { renderDashboard, renderModal, clearScreen } from "../tui/display.js";
import { logger } from "../utils/logger.js";
import { createSpinner } from "../utils/spinner.js";
import { createCommand } from "./create.js";
import { runCommand } from "./run.js";
import { prCommand } from "./pr.js";
import { fixCommand } from "./fix.js";
import { listCommand } from "./list.js";
import { buildVideoPrompt, buildCommitMessagePrompt } from "../lib/prompts.js";
import { invokeAI, invokeAIInteractive, getProviderDisplayName, getProviderEmail } from "../lib/ai-provider.js";
import { loadAgentInstructions, updateConfigProvider } from "../lib/config.js";
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

async function loadState(): Promise<TuiState> {
  clearScreen();
  renderModal("Loading workflow state...");
  const state = await aggregateState();
  return state;
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

async function executeAction(actionId: string, state: TuiState): Promise<boolean> {
  switch (actionId) {
    case "quit":
      return false;

    case "list":
      clearScreen();
      await listCommand({ status: "ready", limit: 20 });
      await promptContinue();
      return true;

    case "run-auto": {
      clearScreen();
      if (!await confirm("Start AI agent to implement next ticket?")) return true;
      await runCommand(undefined, { auto: true });
      return false;
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
      await createCommand(description, {});
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
      if (!await confirm("Create a pull request?")) return true;
      await prCommand({});
      await promptContinue();
      return true;
    }

    case "fix": {
      clearScreen();
      if (!await confirm("Start AI agent to fix review feedback?")) return true;
      await fixCommand({});
      return false;
    }

    case "video": {
      clearScreen();
      if (!await confirm("Record video of UI changes?")) return true;
      await handleVideoCapture(state);
      await promptContinue();
      return true;
    }

    case "switch-provider":
      clearScreen();
      await handleSwitchProvider(state);
      return true;

    case "checkout-main": {
      clearScreen();
      if (!await confirm("Switch to main branch?")) return true;
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
    const { stdout: diffStat } = await execa("git", ["diff", "--cached", "--stat"]);
    const { stdout: diffPatch } = await execa("git", ["diff", "--cached"]);
    const diffContent = (diffStat + "\n\n" + diffPatch).slice(0, 4000);

    const issueNumber = state.issue?.number ?? null;
    const issueTitle = state.issue?.title ?? null;
    const provider = state.config.ai.provider;
    const providerName = getProviderDisplayName(provider);
    logger.info(`Generating commit message with ${providerName}...`);

    const message = await generateCommitMessage(diffContent, issueNumber, issueTitle, state);
    if (message === CANCEL) {
      await execa("git", ["reset", "HEAD"]);
      logger.info("Cancelled");
      return;
    }

    console.log();
    logger.info(`Message: ${message}`);
    console.log();

    if (!await confirm("Commit with this message?")) {
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
  state: TuiState,
): Promise<string | typeof CANCEL> {
  try {
    const prompt = buildCommitMessagePrompt(diffContent, issueNumber, issueTitle);
    const result = await invokeAI({ prompt, streamOutput: true }, state.config);
    let message = result.output.trim().split("\n")[0].trim();
    if ((message.startsWith('"') && message.endsWith('"')) ||
        (message.startsWith("'") && message.endsWith("'"))) {
      message = message.slice(1, -1);
    }
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

async function handlePush(): Promise<void> {
  try {
    const { stdout: branch } = await execa("git", ["branch", "--show-current"]);
    if (!await confirm(`Push ${branch.trim()} to remote?`)) return;

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
        name: p.charAt(0).toUpperCase() + p.slice(1) + (p === current ? " (current)" : ""),
        value: p,
      })),
      default: current,
    },
  ]);

  if (provider === current) return;

  try {
    updateConfigProvider(provider);
    logger.success(`Provider switched to ${provider}`);
  } catch (error) {
    logger.error(`Failed to switch provider: ${error}`);
  }
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

async function handleVideoCapture(state: TuiState): Promise<void> {
  if (!state.issue) {
    logger.error("No linked issue found");
    return;
  }

  try {
    const agentInstructions = loadAgentInstructions();
    const videoPrompt = buildVideoPrompt(
      state.issue.number,
      state.issue.title,
      state.config.video,
      agentInstructions
    );
    await invokeAIInteractive(videoPrompt, state.config);
    logger.success("Video capture completed");
  } catch (error) {
    logger.error(`Video capture failed: ${error}`);
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

  while (running) {
    const state = await loadState();
    clearScreen();

    const actions = getAvailableActions(state);

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
