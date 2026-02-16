/**
 * Default prompt templates for all AI interactions.
 * Users can override any prompt via .gent.yml (prompts section) or .gent-prompts.yml.
 * Templates use {variable_name} syntax for interpolation.
 */

export const DEFAULT_PROMPTS: Record<string, string> = {
  ticket: `You are creating a GitHub issue for a software project following an AI-assisted development workflow.

User Request: {description}

{agent_instructions_section}{additional_hints_section}
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

Example: META:type=feature,priority=high,risk=low,area=ui`,

  implementation: `GitHub Issue #{issue_number}: {issue_title}

{issue_body}

{agent_instructions_section}{progress_section}{extra_context_section}
## Your Task

1. **Implement the feature/fix** following patterns from the project's AGENT.md or codebase conventions
2. **Add unit tests** for any new functionality
3. **Run validation** before committing:
{validation_commands}
4. **Make an atomic commit** with a clear message following conventional commits format:
   - Use format: <type>: <description>
   - Include "Completed GitHub issue #{issue_number}" in body
   - End with: Co-Authored-By: {provider_name} <{provider_email}>
5. **Update {progress_file}** - append a compact entry documenting your work:
      [YYYY-MM-DD] #{issue_number} <type>: <brief description>
   - Files: <comma-separated list of changed files>
   - Changes: <1-2 sentence summary of what was implemented>
   - Decisions: <key technical decisions made, if any>
   - Issues: <concerns or follow-ups for reviewers, if any>
      Keep entries minimal (4-6 lines max). Skip sections if not applicable.
6. **Do NOT push** - the user will review and push manually

Focus on clean, minimal implementation. Don't over-engineer.`,

  pr: `Generate a pull request description for the following changes.

{issue_section}
## Commits
{commits}

## Changed Files
{diff_summary}

Generate a PR description in this format:

## Summary
- [1-3 bullet points summarizing the changes]

## Test Plan
- [ ] [Testing steps]

{close_reference}

Only output the PR description, nothing else.`,

  commit_message: `Generate a concise git commit message for the following changes.
{issue_context}
## Diff
{diff}

Rules:
- Use conventional commit format: <type>: <short description>
- Types: feat, fix, refactor, chore, docs, test, style, perf
- Keep the first line under 72 characters
- Do NOT include a body or footer
- Output ONLY the commit message, nothing else`,

  commit: `Create a git commit for the staged changes.

Context: {issue_context}

Steps:
1. Run \`git diff --cached --stat\` to see what files changed
2. Run \`git diff --cached\` to see the actual changes
3. Generate a commit message following these rules:
   - Use conventional commit format: <type>: <short description>
   - Types: feat, fix, refactor, chore, docs, test, style, perf
   - Keep the first line under 72 characters
   - Add a blank line, then: Co-Authored-By: {provider_name} <{provider_email}>
4. Run \`git commit -m "<your message>"\` to create the commit
5. Exit when done

Do not ask for confirmation - just create the commit.`,

  video: `You are helping capture a Playwright video demonstration of UI changes for GitHub Issue #{issue_number}: {issue_title}

{agent_instructions_section}
## Task: Record UI Demo Video

Create a short video (max {max_duration}s) demonstrating the UI changes made for this issue.

### Video Requirements
- Resolution: {width}x{height}
- Format: WebM or MP4
- Duration: Under {max_duration} seconds
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

Output the GitHub URL where the video was uploaded when complete.`,

  pr_video: `
IMPORTANT: This PR contains UI changes. Use the Playwright MCP plugin to:
1. Start the dev server if needed
2. Navigate to the relevant pages showing the UI changes
3. Capture a short demo video (max {max_duration}s) showcasing the changes
4. Upload the video to GitHub and include it in the PR description under a "## Demo Video" section
`,
};

/**
 * Interpolate variables in a prompt template.
 * Replaces {variable_name} with corresponding values.
 * Unresolved variables are left as-is.
 */
export function interpolate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return key in variables ? variables[key] : match;
  });
}
