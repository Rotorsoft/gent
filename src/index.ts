import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { setupLabelsCommand } from "./commands/setup-labels.js";
import { createCommand } from "./commands/create.js";
import { listCommand } from "./commands/list.js";
import { runCommand } from "./commands/run.js";
import { prCommand } from "./commands/pr.js";
import { statusCommand } from "./commands/status.js";

const program = new Command();

program
  .name("gent")
  .description("AI-powered GitHub workflow CLI - leverage Claude AI to create tickets, implement features, and manage PRs")
  .version("0.1.0");

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
  .action(async (description, options) => {
    await createCommand(description, { yes: options.yes });
  });

program
  .command("list")
  .description("List GitHub issues by label/status")
  .option("-l, --label <label>", "Filter by label")
  .option("-s, --status <status>", "Filter by workflow status (ready, in-progress, completed, blocked, all)")
  .option("-n, --limit <number>", "Maximum number of issues to show", "20")
  .action(async (options) => {
    await listCommand({
      label: options.label,
      status: options.status,
      limit: parseInt(options.limit, 10),
    });
  });

program
  .command("run [issue-number]")
  .description("Run Claude to implement a GitHub issue")
  .option("-a, --auto", "Auto-select highest priority ai-ready issue")
  .action(async (issueNumber, options) => {
    await runCommand(issueNumber, { auto: options.auto });
  });

program
  .command("pr")
  .description("Create an AI-enhanced pull request")
  .option("-d, --draft", "Create as draft PR")
  .action(async (options) => {
    await prCommand({ draft: options.draft });
  });

program
  .command("status")
  .description("Show current workflow status")
  .action(async () => {
    await statusCommand();
  });

program.parse();
