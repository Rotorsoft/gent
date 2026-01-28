import type { GentConfig } from "../types/index.js";
import { getProviderDisplayName, getProviderEmail } from "./ai-provider.js";

export function buildTicketPrompt(
  description: string,
  agentInstructions: string | null,
  additionalHints: string | null = null
): string {
  const basePrompt = `You are creating a GitHub issue for a software project following an AI-assisted development workflow.

User Request: ${description}

${agentInstructions ? `Project-Specific Instructions:\n${agentInstructions}\n\n` : ""}${additionalHints ? `Additional Context/Hints:\n${additionalHints}\n\n` : ""}

Create a detailed GitHub issue following this exact template.

IMPORTANT: Start your output IMMEDIATELY with "TITLE:" followed by a clear, concise issue title in imperative mood (e.g., "Add OAuth2 authentication for Google and GitHub"). Keep titles under 100 characters when possible. Then on the next line, start with "## Description". Do not include any preamble, commentary, or introduction.

TITLE: [Clear, concise issue title in imperative mood]

## Description
[Clear user-facing description of what needs to be done]

## Technical Context
**Type:** feature | fix | refactor | chore | docs | test
**Category:** ui | api | database | workers | shared | testing | infra
**Priority:** critical | high | medium | low
**Risk:** low | medium | high

### Architecture Notes
- [Relevant patterns to follow]
- [Related systems affected]
- [Constraints or invariants]

## Implementation Steps
- [ ] Step 1: Specific technical task
- [ ] Step 2: Specific technical task
- [ ] Step 3: Specific technical task

## Testing Requirements
- **Unit tests:** [What to test]
- **Integration tests:** [What to test if applicable]
- **Manual verification:** [What to check]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

---
IMPORTANT: After the issue content, on a new line, output ONLY the following metadata in this exact format:
META:type=<type>,priority=<priority>,risk=<risk>,area=<area>

Example: META:type=feature,priority=high,risk=low,area=ui`;

  return basePrompt;
}

export function buildImplementationPrompt(
  issue: { number: number; title: string; body: string },
  agentInstructions: string | null,
  progressContent: string | null,
  config: GentConfig,
  reviewFeedback: string | null = null
): string {
  const providerName = getProviderDisplayName(config.ai.provider);
  const providerEmail = getProviderEmail(config.ai.provider);

  return `GitHub Issue #${issue.number}: ${issue.title}

${issue.body}

${agentInstructions ? `## Project-Specific Instructions\n${agentInstructions}\n\n` : ""}
${progressContent ? `## Previous Progress\n${progressContent}\n\n` : ""}
${reviewFeedback ? `## Review Feedback\n${reviewFeedback}\n\n` : ""}

## Your Task

1. **Implement the feature/fix** following patterns from the project's AGENT.md or codebase conventions
2. **Add unit tests** for any new functionality
3. **Run validation** before committing:
${config.validation.map((cmd) => `   - ${cmd}`).join("\n")}
4. **Make an atomic commit** with a clear message following conventional commits format:
   - Use format: <type>: <description>
   - Include "Completed GitHub issue #${issue.number}" in body
   - End with: Co-Authored-By: ${providerName} <${providerEmail}>
5. **Update ${config.progress.file}** - append a compact entry documenting your work:
   \
   [YYYY-MM-DD] #${issue.number} <type>: <brief description>
   - Files: <comma-separated list of changed files>
   - Changes: <1-2 sentence summary of what was implemented>
   - Decisions: <key technical decisions made, if any>
   - Issues: <concerns or follow-ups for reviewers, if any>
   \
   Keep entries minimal (4-6 lines max). Skip sections if not applicable.
6. **Do NOT push** - the user will review and push manually

Focus on clean, minimal implementation. Don't over-engineer.`;
}

export function buildPrPrompt(
  issue: { number: number; title: string; body: string } | null,
  commits: string[],
  diffSummary: string
): string {
  return `Generate a pull request description for the following changes.

${issue ? `## Related Issue\n#${issue.number}: ${issue.title}\n\n${issue.body}\n\n` : ""}

## Commits
${commits.map((c) => `- ${c}`).join("\n")}

## Changed Files
${diffSummary}

Generate a PR description in this format:

## Summary
- [1-3 bullet points summarizing the changes]

## Test Plan
- [ ] [Testing steps]

${issue ? `Closes #${issue.number}` : ""}

Only output the PR description, nothing else.`;
}

export function buildCommitMessagePrompt(
  diff: string,
  issueNumber: number | null,
  issueTitle: string | null,
): string {
  const issueContext = issueNumber
    ? `\nRelated Issue: #${issueNumber}${issueTitle ? ` - ${issueTitle}` : ""}\n`
    : "";

  return `Generate a concise git commit message for the following changes.
${issueContext}
## Diff
${diff}

Rules:
- Use conventional commit format: <type>: <short description>
- Types: feat, fix, refactor, chore, docs, test, style, perf
- Keep the first line under 72 characters
- Do NOT include a body or footer
- Output ONLY the commit message, nothing else`;
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
  let body = output.replace(/\n?META:type=\w+,priority=\w+,risk=\w+,area=\w+\s*$/, "").trim();

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
  if ((title.startsWith('"') && title.endsWith('"')) ||
      (title.startsWith("'") && title.endsWith("'"))) {
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
  return `You are helping capture a Playwright video demonstration of UI changes for GitHub Issue #${issueNumber}: ${issueTitle}

${agentInstructions ? `## Project-Specific Instructions\n${agentInstructions}\n\n` : ""}

## Task: Record UI Demo Video

Create a short video (max ${videoConfig.max_duration}s) demonstrating the UI changes made for this issue.

### Video Requirements
- Resolution: ${videoConfig.width}x${videoConfig.height}
- Format: WebM or MP4
- Duration: Under ${videoConfig.max_duration} seconds
- Show the key UI interactions and visual changes

### Steps

1. **Start the development server** if not already running
2. **Use Playwright to record video** of the relevant UI interactions:
   - Navigate to the affected pages/components
   - Demonstrate the new or changed functionality
   - Show before/after if applicable

3. **Upload video to GitHub** as a release asset or use GitHub's drag-drop upload:
   - Create a GitHub release or upload to issue comments
   - Get the permanent URL for the video
   - Do NOT commit video files to the repository

4. **Add video to PR** by commenting with the video URL or embedding it

### Important
- Upload video to GitHub assets, NOT to the repository
- Keep the video concise - focus on demonstrating the changes
- Ensure the video clearly shows the UI improvements

Output the GitHub URL where the video was uploaded when complete.`;
}
