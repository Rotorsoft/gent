import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { setupLabelsCommand } from "./commands/setup-labels.js";
import { createCommand } from "./commands/create.js";
import { listCommand } from "./commands/list.js";
import { runCommand } from "./commands/run.js";
import { prCommand } from "./commands/pr.js";
import { statusCommand } from "./commands/status.js";
import { getVersion } from "./lib/version.js";

const version = getVersion();

const program = new Command();

program
  .name("gent")
  .description("AI-powered GitHub workflow CLI - leverage AI (Claude or Gemini) to create tickets, implement features, and manage PRs")
  .version(version);

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
  .option("-p, --provider <provider>", "AI provider to use (claude or gemini)")
  .option("-t, --title <title>", "Override the generated issue title")
  .action(async (description, options) => {
    await createCommand(description, { yes: options.yes, provider: options.provider, title: options.title });
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
  .description("Run AI to implement a GitHub issue")
  .option("-a, --auto", "Auto-select highest priority ai-ready issue")
  .option("-p, --provider <provider>", "AI provider to use (claude or gemini)")
  .action(async (issueNumber, options) => {
    await runCommand(issueNumber, { auto: options.auto, provider: options.provider });
  });

program
  .command("pr")
  .description("Create an AI-enhanced pull request")
  .option("-d, --draft", "Create as draft PR")
  .option("-p, --provider <provider>", "AI provider to use (claude or gemini)")
  .action(async (options) => {
    await prCommand({ draft: options.draft, provider: options.provider });
  });

program
  .command("status")
  .description("Show current workflow status")
  .action(async () => {
    await statusCommand();
  });

program.parse();