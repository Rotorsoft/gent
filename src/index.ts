import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { setupLabelsCommand } from "./commands/setup-labels.js";
import { createCommand } from "./commands/create.js";
import { listCommand } from "./commands/list.js";
import { runCommand } from "./commands/run.js";
import { prCommand } from "./commands/pr.js";
import { fixCommand } from "./commands/fix.js";
import { statusCommand } from "./commands/status.js";
import { tuiCommand } from "./commands/tui.js";
import { githubRemoteCommand } from "./commands/github-remote.js";
import {
  getVersion,
  checkForUpdates,
  formatUpgradeNotification,
} from "./lib/version.js";
import { logger } from "./utils/logger.js";
import { checkInitialized } from "./utils/validators.js";
import { checkLabelsExist } from "./lib/github.js";
import { getRepoInfo } from "./lib/git.js";

const version = getVersion();

function startVersionCheck(): void {
  // Skip if disabled via environment variable
  if (process.env.GENT_SKIP_UPDATE_CHECK === "1") return;

  checkForUpdates()
    .then((result) => {
      if (result.updateAvailable && result.latestVersion) {
        logger.newline();
        logger.warning(
          formatUpgradeNotification(result.currentVersion, result.latestVersion)
        );
      }
    })
    .catch(() => {
      // Silently ignore errors
    });
}

/** Returns true if prerequisites are met, false if command should abort. */
async function checkPrerequisites(): Promise<boolean> {
  if (!checkInitialized()) {
    logger.warning('Repository not initialized. Run "gent init" to set up this repository.');
    return false;
  }
  const repoInfo = await getRepoInfo();
  if (!repoInfo) {
    logger.warning('No GitHub remote found. Run "gent github-remote" to create one.');
    return false;
  }
  const labelsOk = await checkLabelsExist();
  if (!labelsOk) {
    logger.warning('GitHub labels not found. Run "gent setup-labels" to create required labels.');
    return false;
  }
  return true;
}

const program = new Command();

program
  .name("gent")
  .description(
    "AI-powered GitHub workflow CLI - leverage AI (Claude, Gemini, or Codex) to create tickets, implement features, and manage PRs"
  )
  .version(version)
  .option("--skip-update-check", "Skip checking for CLI updates")
  .hook("preAction", (thisCommand) => {
    // Start version check before any command runs (unless skipped)
    if (!thisCommand.opts().skipUpdateCheck) {
      startVersionCheck();
    }
  });

program
  .command("init")
  .description("Initialize gent workflow in current repository")
  .option("-f, --force", "Overwrite existing configuration")
  .action(async (options) => {
    await initCommand(options);
  });

program
  .command("setup-labels")
  .description("Setup GitHub labels for AI workflow")
  .action(async () => {
    await setupLabelsCommand();
  });

program
  .command("create <description>")
  .description("Create an AI-enhanced GitHub issue")
  .option("-y, --yes", "Skip confirmation and create issue immediately")
  .option(
    "-p, --provider <provider>",
    "AI provider to use (claude, gemini, or codex)"
  )
  .option("-t, --title <title>", "Override the generated issue title")
  .action(async (description, options) => {
    if (!(await checkPrerequisites())) return;
    await createCommand(description, {
      yes: options.yes,
      provider: options.provider,
      title: options.title,
    });
  });

program
  .command("list")
  .description("List and switch to GitHub issues")
  .option("-l, --label <label>", "Filter by label")
  .option(
    "-s, --status <status>",
    "Filter by workflow status (ready, in-progress, completed, blocked, all)"
  )
  .option("-n, --limit <number>", "Maximum number of issues to show", "20")
  .action(async (options) => {
    if (!(await checkPrerequisites())) return;
    await listCommand({
      label: options.label,
      status: options.status,
      limit: parseInt(options.limit, 10),
    });
  });

program
  .command("run [issue-number]")
  .description("Run AI to implement a GitHub issue")
  .option(
    "-p, --provider <provider>",
    "AI provider to use (claude, gemini, or codex)"
  )
  .action(async (issueNumber, options) => {
    if (!(await checkPrerequisites())) return;
    await runCommand(issueNumber, { provider: options.provider });
  });

program
  .command("pr")
  .description("Create an AI-enhanced pull request")
  .option("-d, --draft", "Create as draft PR")
  .option(
    "-p, --provider <provider>",
    "AI provider to use (claude, gemini, or codex)"
  )
  .option("--no-video", "Disable video capture for UI changes")
  .action(async (options) => {
    if (!(await checkPrerequisites())) return;
    await prCommand({
      draft: options.draft,
      provider: options.provider,
      video: options.video,
    });
  });

program
  .command("fix")
  .description("Apply PR review feedback using AI")
  .option(
    "-p, --provider <provider>",
    "AI provider to use (claude, gemini, or codex)"
  )
  .action(async (options) => {
    if (!(await checkPrerequisites())) return;
    await fixCommand({ provider: options.provider });
  });

program
  .command("status")
  .description("Show current workflow status")
  .action(async () => {
    if (!(await checkPrerequisites())) return;
    await statusCommand();
  });

program
  .command("github-remote")
  .description("Create a GitHub repository and push local repo")
  .action(async () => {
    await githubRemoteCommand();
  });

program
  .command("ui")
  .description("Launch interactive dashboard")
  .action(async () => {
    await tuiCommand();
  });

// Launch dashboard when `gent` is run with no subcommand
program.action(async () => {
  await tuiCommand();
});

program.parse();
