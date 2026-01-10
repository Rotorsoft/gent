import inquirer from "inquirer";
import chalk from "chalk";
import { logger, colors } from "../utils/logger.js";
import { withSpinner } from "../utils/spinner.js";
import { loadAgentInstructions } from "../lib/config.js";
import {
  invokeClaude,
  buildTicketPrompt,
  parseTicketMeta,
  extractIssueBody,
} from "../lib/claude.js";
import { createIssue } from "../lib/github.js";
import { buildIssueLabels } from "../lib/labels.js";
import { checkGhAuth, checkClaudeCli } from "../utils/validators.js";

export interface CreateOptions {
  yes?: boolean;
}

interface TicketMeta {
  type: string;
  priority: string;
  risk: string;
  area: string;
}

export async function createCommand(
  description: string,
  options: CreateOptions
): Promise<void> {
  logger.bold("Creating AI-enhanced ticket...");
  logger.newline();

  // Validate prerequisites
  const [ghAuth, claudeOk] = await Promise.all([checkGhAuth(), checkClaudeCli()]);

  if (!ghAuth) {
    logger.error("Not authenticated with GitHub. Run 'gh auth login' first.");
    process.exit(1);
  }

  if (!claudeOk) {
    logger.error("Claude CLI not found. Please install claude CLI first.");
    process.exit(1);
  }

  const agentInstructions = loadAgentInstructions();

  // Generate ticket with Claude (may loop if user wants to regenerate)
  let claudeOutput: string;
  let additionalHints: string | null = null;

  while (true) {
    // Build prompt and invoke Claude
    const prompt = buildTicketPrompt(description, agentInstructions, additionalHints);

    try {
      // Show visual indicator before Claude output
      console.log(chalk.dim("┌─ Generating ticket... ─────────────────────────────────────┐"));
      logger.newline();
      claudeOutput = await invokeClaude({ prompt, streamOutput: true });
      logger.newline();
      console.log(chalk.dim("└────────────────────────────────────────────────────────────┘"));
      logger.newline();
    } catch (error) {
      logger.error(`Claude invocation failed: ${error}`);
      return;
    }

    // Parse metadata
    const meta = parseTicketMeta(claudeOutput);
    if (!meta) {
      logger.warning("Could not parse metadata from Claude output. Using defaults.");
    }

    const finalMeta: TicketMeta = meta || {
      type: "feature",
      priority: "medium",
      risk: "low",
      area: "shared",
    };

    // Extract issue body (without META line)
    const issueBody = extractIssueBody(claudeOutput);

    // Generate title from description
    const title =
      description.length > 60 ? description.slice(0, 57) + "..." : description;

    // Build labels
    const labels = buildIssueLabels(finalMeta);

    // Show ticket preview
    displayTicketPreview(title, finalMeta, issueBody);

    // Skip confirmation if --yes flag is passed
    if (options.yes) {
      await createAndDisplayIssue(title, issueBody, labels, finalMeta);
      return;
    }

    // Ask for confirmation
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "What would you like to do?",
        choices: [
          { name: "Create issue", value: "create" },
          { name: "Edit description and regenerate", value: "edit" },
          { name: "Cancel", value: "cancel" },
        ],
      },
    ]);

    if (action === "cancel") {
      logger.info("Issue creation cancelled.");
      return;
    }

    if (action === "create") {
      await createAndDisplayIssue(title, issueBody, labels, finalMeta);
      return;
    }

    // action === "edit" - prompt for additional hints
    const { hints } = await inquirer.prompt([
      {
        type: "input",
        name: "hints",
        message: "Enter additional hints or context for Claude:",
      },
    ]);

    if (hints.trim()) {
      additionalHints = additionalHints
        ? `${additionalHints}\n${hints.trim()}`
        : hints.trim();
    }

    logger.newline();
    logger.info("Regenerating ticket with additional context...");
    logger.newline();
  }
}

function displayTicketPreview(
  title: string,
  meta: TicketMeta,
  body: string
): void {
  // Count lines for summary
  const lineCount = body.split("\n").length;

  // Section header helper
  const sectionHeader = (label: string) =>
    console.log(chalk.bold.cyan(`${label}`));

  // Display preview with clean sections
  console.log(chalk.bold.white("━━━ Ticket Preview ━━━"));
  logger.newline();

  sectionHeader("Title");
  console.log(`  ${title}`);
  logger.newline();

  sectionHeader("Labels");
  console.log(
    `  ${colors.label(`type:${meta.type}`)}  ${colors.label(`priority:${meta.priority}`)}  ${colors.label(`risk:${meta.risk}`)}  ${colors.label(`area:${meta.area}`)}`
  );
  logger.newline();

  sectionHeader(`Body (${lineCount} lines)`);
  // Indent each line of the body for visual hierarchy
  const bodyLines = body.split("\n");
  for (const line of bodyLines) {
    console.log(`  ${line}`);
  }

  logger.newline();
  console.log(chalk.bold.white("━━━━━━━━━━━━━━━━━━━━━━"));
  logger.newline();
}

async function createAndDisplayIssue(
  title: string,
  body: string,
  labels: string[],
  meta: TicketMeta
): Promise<void> {
  let issueNumber: number;
  try {
    issueNumber = await withSpinner("Creating GitHub issue...", async () => {
      return createIssue({
        title,
        body,
        labels,
      });
    });
  } catch (error) {
    logger.error(`Failed to create issue: ${error}`);
    return;
  }

  logger.newline();
  logger.success(`Created issue ${colors.issue(`#${issueNumber}`)}`);
  logger.newline();

  logger.box(
    "Issue Created",
    `Issue: ${colors.issue(`#${issueNumber}`)}
Type: ${colors.label(`type:${meta.type}`)}
Priority: ${colors.label(`priority:${meta.priority}`)}
Risk: ${colors.label(`risk:${meta.risk}`)}
Area: ${colors.label(`area:${meta.area}`)}

Next steps:
1. Review the issue on GitHub
2. Run ${colors.command(`gent run ${issueNumber}`)} to implement`
  );
}
