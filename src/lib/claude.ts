import { execa, type ResultPromise } from "execa";
import type { GentConfig } from "../types/index.js";

export interface ClaudeOptions {
  prompt: string;
  permissionMode?: string;
  printOutput?: boolean;
}

export async function invokeClaude(options: ClaudeOptions): Promise<string> {
  const args = ["--print"];

  if (options.permissionMode) {
    args.push("--permission-mode", options.permissionMode);
  }

  args.push(options.prompt);

  if (options.printOutput) {
    // Stream output to console
    const subprocess = execa("claude", args, {
      stdio: "inherit",
    });
    await subprocess;
    return "";
  } else {
    const { stdout } = await execa("claude", args);
    return stdout;
  }
}

export async function invokeClaudeInteractive(
  prompt: string,
  config: GentConfig
): Promise<ResultPromise> {
  const args = ["--permission-mode", config.claude.permission_mode, prompt];

  return execa("claude", args, {
    stdio: "inherit",
  });
}

export function buildTicketPrompt(
  description: string,
  agentInstructions: string | null
): string {
  const basePrompt = `You are creating a GitHub issue for a software project following an AI-assisted development workflow.

User Request: ${description}

${agentInstructions ? `Project-Specific Instructions:\n${agentInstructions}\n\n` : ""}

Create a detailed GitHub issue following this exact template:

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
5. **Do NOT push** - the user will review and push manually

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
  return output.replace(/\n?META:type=\w+,priority=\w+,risk=\w+,area=\w+\s*$/, "").trim();
}
