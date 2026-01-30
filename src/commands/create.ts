import inquirer from "inquirer";
import chalk from "chalk";
import { logger, colors } from "../utils/logger.js";
import { withSpinner } from "../utils/spinner.js";
import {
  loadConfig,
  loadAgentInstructions,
  resolveProvider,
} from "../lib/config.js";
import {
  buildTicketPrompt,
  parseTicketMeta,
  extractIssueBody,
  extractTitle,
  generateFallbackTitle,
} from "../lib/prompts.js";
import {
  invokeAI,
  getProviderDisplayName,
  getOtherAvailableProviders,
} from "../lib/ai-provider.js";
import { createIssue } from "../lib/github.js";
import { buildIssueLabels } from "../lib/labels.js";
import { checkGhAuth, checkAIProvider } from "../utils/validators.js";
import type { AIProvider } from "../types/index.js";

export interface CreateOptions {
  yes?: boolean;
  provider?: AIProvider;
  title?: string;
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

  const config = loadConfig();

  // Determine which provider to use
  let currentProvider = resolveProvider(options, config);

  // Validate prerequisites
  const [ghAuth, aiOk] = await Promise.all([
    checkGhAuth(),
    checkAIProvider(currentProvider),
  ]);

  if (!ghAuth) {
    logger.error("Not authenticated with GitHub. Run 'gh auth login' first.");
    return;
  }

  if (!aiOk) {
    logger.error(
      `${getProviderDisplayName(currentProvider)} CLI not found. Please install ${currentProvider} CLI first.`
    );
    return;
  }

  const agentInstructions = loadAgentInstructions();

  // Generate ticket with AI (may loop if user wants to regenerate)
  let aiOutput: string;
  let additionalHints: string | null = null;

  while (true) {
    const providerName = getProviderDisplayName(currentProvider);
    // Build prompt and invoke AI
    const prompt = buildTicketPrompt(
      description,
      agentInstructions,
      additionalHints
    );

    try {
      // Show visual indicator before AI output
      console.log(
        chalk.dim(
          `┌─ Generating ticket with ${providerName}... ──────────────────────────┐`
        )
      );
      logger.newline();
      const result = await invokeAI(
        { prompt, streamOutput: true },
        config,
        currentProvider
      );
      aiOutput = result.output;
      logger.newline();
      console.log(
        chalk.dim(
          "└────────────────────────────────────────────────────────────┘"
        )
      );
      logger.newline();
    } catch (error) {
      if (error && typeof error === "object" && "rateLimited" in error) {
        logger.warning(`${providerName} is rate limited.`);

        const others = await getOtherAvailableProviders(currentProvider);
        if (others.length > 0) {
          const { nextProvider } = await inquirer.prompt([
            {
              type: "list",
              name: "nextProvider",
              message: "Would you like to try another provider?",
              choices: [
                ...others.map((p) => ({
                  name: `Switch to ${getProviderDisplayName(p)}`,
                  value: p,
                })),
                { name: "Cancel", value: "cancel" },
              ],
            },
          ]);

          if (nextProvider !== "cancel") {
            currentProvider = nextProvider as AIProvider;
            logger.info(
              `Switching to ${getProviderDisplayName(currentProvider)}...`
            );
            continue;
          }
        }
      }

      logger.error(`${providerName} invocation failed: ${error}`);
      return;
    }

    // Parse metadata
    const meta = parseTicketMeta(aiOutput);
    if (!meta) {
      logger.warning(
        "Could not parse metadata from AI output. Using defaults."
      );
    }

    const finalMeta: TicketMeta = meta || {
      type: "feature",
      priority: "medium",
      risk: "low",
      area: "shared",
    };

    // Extract issue body (without META line) and append signature
    const issueBody =
      extractIssueBody(aiOutput) +
      `\n\n---\n*Created with ${providerName} by [gent](https://github.com/Rotorsoft/gent)*`;

    // Determine title: user override > AI-generated > fallback
    let title: string;
    if (options.title) {
      title = options.title;
    } else {
      const aiTitle = extractTitle(aiOutput);
      if (aiTitle) {
        title = aiTitle;
      } else {
        title = generateFallbackTitle(description);
        logger.warning("Could not extract AI-generated title. Using fallback.");
      }
    }

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
        message: "Enter additional hints or context for the AI:",
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
