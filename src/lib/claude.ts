import type { GentConfig } from "../types/index.js";

export function buildTicketPrompt(
  description: string,
  agentInstructions: string | null,
  additionalHints: string | null = null
): string {
  const basePrompt = `You are creating a GitHub issue for a software project following an AI-assisted development workflow.

User Request: ${description}

${agentInstructions ? `Project-Specific Instructions:\n${agentInstructions}\n\n` : ""}${additionalHints ? `Additional Context/Hints:\n${additionalHints}\n\n` : ""}

Create a detailed GitHub issue following this exact template.

IMPORTANT: Start your output IMMEDIATELY with "## Description" - do not include any preamble, commentary, or introduction before the template.

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

Example: META:type=feature,priority=high,risk=low,area=ui
`;

  return basePrompt;
}

export function buildImplementationPrompt(
  issue: { number: number; title: string; body: string },
  agentInstructions: string | null,
  progressContent: string | null,
  config: GentConfig
): string {
  return `GitHub Issue #${issue.number}: ${issue.title}

${issue.body}

${agentInstructions ? `## Project-Specific Instructions\n${agentInstructions}\n\n` : ""}
${progressContent ? `## Previous Progress\n${progressContent}\n\n` : ""}

## Your Task

1. **Implement the feature/fix** following patterns from the project's AGENT.md or codebase conventions
2. **Add unit tests** for any new functionality
3. **Run validation** before committing:
${config.validation.map((cmd) => `   - ${cmd}`).join("\n")}
4. **Make an atomic commit** with a clear message following conventional commits format:
   - Use format: <type>: <description>
   - Include "Completed GitHub issue #${issue.number}" in body
   - End with: Co-Authored-By: Claude <noreply@anthropic.com>
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

  // Strip any preamble text before "## Description"
  const descriptionIndex = body.indexOf("## Description");
  if (descriptionIndex > 0) {
    body = body.substring(descriptionIndex);
  }

  return body;
}