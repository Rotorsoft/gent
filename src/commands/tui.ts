import inquirer from "inquirer";
import { execa } from "execa";
import { aggregateState, type TuiState } from "../tui/state.js";
import { getAvailableActions } from "../tui/actions.js";
import { renderDashboard, renderCommandBar, renderHint, clearScreen } from "../tui/display.js";
import { logger } from "../utils/logger.js";
import { createSpinner } from "../utils/spinner.js";
import { createCommand } from "./create.js";
import { runCommand } from "./run.js";
import { prCommand } from "./pr.js";
import { fixCommand } from "./fix.js";
import { listCommand } from "./list.js";
import { buildVideoPrompt } from "../lib/prompts.js";
import { invokeAIInteractive } from "../lib/ai-provider.js";
import { loadAgentInstructions } from "../lib/config.js";

async function loadState(): Promise<TuiState> {
  const spinner = createSpinner("Loading...");
  spinner.start();
  try {
    const state = await aggregateState();
    spinner.stop();
    // Clear the spinner line
    process.stdout.write("\x1B[1A\x1B[2K");
    return state;
  } catch (error) {
    spinner.stop();
    process.stdout.write("\x1B[1A\x1B[2K");
    throw error;
  }
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

      const lower = key.toLowerCase();
      if (validKeys.includes(lower)) {
        stdin.setRawMode(wasRaw ?? false);
        stdin.pause();
        stdin.removeListener("data", onData);
        resolve(lower);
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
      console.log();
      await listCommand({ status: "ready", limit: 20 });
      await promptContinue();
      return true;

    case "run-auto":
      console.log();
      await runCommand(undefined, { auto: true });
      return false;

    case "run":
      console.log();
      if (state.issue) {
        await runCommand(String(state.issue.number), {});
      }
      return false;

    case "create": {
      console.log();
      const { description } = await inquirer.prompt<{ description: string }>([
        {
          type: "input",
          name: "description",
          message: "Describe the ticket:",
          validate: (input: string) => input.trim().length > 0 || "Description is required",
        },
      ]);
      await createCommand(description, {});
      await promptContinue();
      return true;
    }

    case "commit":
      console.log();
      await handleCommit();
      await promptContinue();
      return true;

    case "push":
      console.log();
      await handlePush();
      await promptContinue();
      return true;

    case "pr":
      console.log();
      await prCommand({});
      await promptContinue();
      return true;

    case "fix":
      console.log();
      await fixCommand({});
      return false;

    case "video":
      console.log();
      await handleVideoCapture(state);
      await promptContinue();
      return true;

    case "checkout-main":
      console.log();
      await handleCheckoutMain();
      return true;

    default:
      return true;
  }
}

async function handleCommit(): Promise<void> {
  try {
    const { stdout: status } = await execa("git", ["status", "--short"]);
    if (!status.trim()) {
      logger.info("No changes to commit");
      return;
    }

    logger.info("Changes:");
    console.log(status);

    const { message, confirmed } = await inquirer.prompt<{ message: string; confirmed: boolean }>([
      {
        type: "input",
        name: "message",
        message: "Commit message:",
        validate: (input: string) => input.trim().length > 0 || "Commit message is required",
      },
      {
        type: "confirm",
        name: "confirmed",
        message: "Stage all changes and commit?",
        default: true,
      },
    ]);

    if (!confirmed) {
      logger.info("Commit cancelled");
      return;
    }

    const spinner = createSpinner("Committing...");
    spinner.start();
    await execa("git", ["add", "-A"]);
    await execa("git", ["commit", "-m", message]);
    spinner.succeed("Changes committed");
  } catch (error) {
    logger.error(`Commit failed: ${error}`);
  }
}

async function handlePush(): Promise<void> {
  try {
    const spinner = createSpinner("Pushing...");
    spinner.start();
    const { stdout: branch } = await execa("git", ["branch", "--show-current"]);
    await execa("git", ["push", "-u", "origin", branch.trim()]);
    spinner.succeed("Pushed to remote");
  } catch (error) {
    logger.error(`Push failed: ${error}`);
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
    clearScreen();

    const state = await loadState();

    renderDashboard(state);

    const actions = getAvailableActions(state);
    renderCommandBar(actions);

    // Show contextual hints
    if (state.isOnMain) {
      renderHint("Select an action to get started");
    } else if (state.hasUncommittedChanges && !state.pr) {
      renderHint("Commit your changes before creating a PR");
    } else if (state.hasActionableFeedback) {
      renderHint("Review feedback needs attention");
    }

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
