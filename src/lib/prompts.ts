import type { GentConfig } from "../types/index.js";
import { getProviderDisplayName, getProviderEmail } from "./ai-provider.js";
import { getPrompt } from "./config.js";

export function buildTicketPrompt(
  description: string,
  agentInstructions: string | null,
  additionalHints: string | null = null
): string {
  const variables: Record<string, string> = {
    description,
    agent_instructions_section: agentInstructions
      ? `Project-Specific Instructions:\n${agentInstructions}\n\n`
      : "",
    additional_hints_section: additionalHints
      ? `Additional Context/Hints:\n${additionalHints}\n\n`
      : "",
  };

  return getPrompt("ticket", variables);
}

export function buildImplementationPrompt(
  issue: { number: number; title: string; body: string },
  agentInstructions: string | null,
  progressContent: string | null,
  config: GentConfig,
  extraContext: string | null = null
): string {
  const providerName = getProviderDisplayName(config.ai.provider);
  const providerEmail = getProviderEmail(config.ai.provider);

  const variables: Record<string, string> = {
    issue_number: String(issue.number),
    issue_title: issue.title,
    issue_body: issue.body,
    agent_instructions_section: agentInstructions
      ? `## Project-Specific Instructions\n${agentInstructions}\n\n`
      : "",
    progress_section: progressContent
      ? `## Previous Progress\n${progressContent}\n\n`
      : "",
    extra_context_section: extraContext ? `${extraContext}\n\n` : "",
    validation_commands: config.validation
      .map((cmd) => `   - ${cmd}`)
      .join("\n"),
    provider_name: providerName,
    provider_email: providerEmail,
    progress_file: config.progress.file,
  };

  return getPrompt("implementation", variables);
}

export function buildPrPrompt(
  issue: { number: number; title: string; body: string } | null,
  commits: string[],
  diffSummary: string
): string {
  const variables: Record<string, string> = {
    issue_section: issue
      ? `## Related Issue\n#${issue.number}: ${issue.title}\n\n${issue.body}\n\n`
      : "",
    commits: commits.map((c) => `- ${c}`).join("\n"),
    diff_summary: diffSummary,
    close_reference: issue ? `Closes #${issue.number}` : "",
  };

  return getPrompt("pr", variables);
}

export function buildCommitMessagePrompt(
  diff: string,
  issueNumber: number | null,
  issueTitle: string | null
): string {
  const issueContext = issueNumber
    ? `\nRelated Issue: #${issueNumber}${issueTitle ? ` - ${issueTitle}` : ""}\n`
    : "";

  const variables: Record<string, string> = {
    issue_context: issueContext,
    diff,
  };

  return getPrompt("commit_message", variables);
}

/**
 * Build prompt for AI to create a commit interactively.
 * The AI will run git diff, generate a message, and commit.
 */
export function buildCommitPrompt(
  issueNumber: number | null,
  issueTitle: string | null,
  config: GentConfig
): string {
  const provider = config.ai.provider;
  const providerName = getProviderDisplayName(provider);
  const providerEmail = getProviderEmail(provider);

  const issueContext = issueNumber
    ? `Related Issue: #${issueNumber}${issueTitle ? ` - ${issueTitle}` : ""}`
    : "No linked issue";

  const variables: Record<string, string> = {
    issue_context: issueContext,
    provider_name: providerName,
    provider_email: providerEmail,
  };

  return getPrompt("commit", variables);
}

export function parseTicketMeta(
  output: string
): { type: string; priority: string; risk: string; area: string } | null {
  const metaMatch = output.match(
    /META:type=(\w+),priority=(\w+),risk=(\w+),area=(\w+)/
  );

  if (!metaMatch) {
    return null;
  }

  return {
    type: metaMatch[1],
    priority: metaMatch[2],
    risk: metaMatch[3],
    area: metaMatch[4],
  };
}

export function extractIssueBody(output: string): string {
  // Remove the META line from the output
  let body = output
    .replace(/\n?META:type=\w+,priority=\w+,risk=\w+,area=\w+\s*$/, "")
    .trim();

  // Strip the TITLE line if present
  body = body.replace(/^TITLE:\s*.+\n+/, "");

  // Strip any preamble text before "## Description"
  const descriptionIndex = body.indexOf("## Description");
  if (descriptionIndex > 0) {
    body = body.substring(descriptionIndex);
  }

  return body;
}

/**
 * Extract the generated title from AI output
 * Returns null if no valid title is found
 */
export function extractTitle(output: string): string | null {
  const match = output.match(/^TITLE:\s*(.+)$/m);
  if (!match) {
    return null;
  }

  let title = match[1].trim();

  // Remove surrounding quotes if present
  if (
    (title.startsWith('"') && title.endsWith('"')) ||
    (title.startsWith("'") && title.endsWith("'"))
  ) {
    title = title.slice(1, -1);
  }

  // Remove template placeholder if AI didn't replace it
  if (title.includes("[") && title.includes("]")) {
    return null;
  }

  // Ensure reasonable length (not empty, not too long)
  if (title.length < 5 || title.length > 200) {
    return null;
  }

  return title;
}

/**
 * Generate a fallback title from the user's description
 * Truncates long descriptions at word boundary without ellipsis
 */
export function generateFallbackTitle(description: string): string {
  const maxLength = 200;
  if (description.length <= maxLength) {
    return description;
  }
  // Truncate at last word boundary before maxLength
  const truncated = description.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.5) {
    return truncated.slice(0, lastSpace);
  }
  return truncated;
}

/**
 * Build prompt for Playwright video capture of UI changes.
 * Instructs AI to upload video to GitHub assets rather than committing to repo.
 */
export function buildVideoPrompt(
  issueNumber: number,
  issueTitle: string,
  videoConfig: { max_duration: number; width: number; height: number },
  agentInstructions: string | null
): string {
  const variables: Record<string, string> = {
    issue_number: String(issueNumber),
    issue_title: issueTitle,
    agent_instructions_section: agentInstructions
      ? `## Project-Specific Instructions\n${agentInstructions}\n\n`
      : "",
    max_duration: String(videoConfig.max_duration),
    width: String(videoConfig.width),
    height: String(videoConfig.height),
  };

  return getPrompt("video", variables);
}

/**
 * Build video capture instructions to append to PR prompts.
 */
export function buildPrVideoPrompt(
  maxDuration: number
): string {
  return getPrompt("pr_video", { max_duration: String(maxDuration) });
}
