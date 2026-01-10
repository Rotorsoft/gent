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

export async function createCommand(description: string): Promise<void> {
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

  // Build prompt and invoke Claude
  const prompt = buildTicketPrompt(description, agentInstructions);

  let claudeOutput: string;
  try {
    logger.info("Generating ticket with Claude...");
    logger.newline();
    claudeOutput = await invokeClaude({ prompt, streamOutput: true });
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

  const finalMeta = meta || {
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

  // Create issue
  let issueNumber: number;
  try {
    issueNumber = await withSpinner("Creating GitHub issue...", async () => {
      return createIssue({
        title,
        body: issueBody,
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

  logger.box("Issue Created", `Issue: ${colors.issue(`#${issueNumber}`)}
Type: ${colors.label(`type:${finalMeta.type}`)}
Priority: ${colors.label(`priority:${finalMeta.priority}`)}
Risk: ${colors.label(`risk:${finalMeta.risk}`)}
Area: ${colors.label(`area:${finalMeta.area}`)}

Next steps:
1. Review the issue on GitHub
2. Run ${colors.command(`gent run ${issueNumber}`)} to implement`);
}
