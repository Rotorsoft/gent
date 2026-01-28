# @rotorsoft/gent

AI-powered GitHub workflow CLI - leverage AI (Claude, Gemini, or Codex) to create tickets, implement features, and manage PRs.

## Overview

`gent` is a command-line tool that integrates AI with GitHub to automate your development workflow:

- **Create AI-enhanced tickets** - Describe what you need, the AI generates detailed GitHub issues with proper labels
- **Implement with AI** - Pick a ticket and let the AI implement it with automatic branch management
- **Track progress** - Maintain a progress log for context across AI sessions
- **Create smart PRs** - Generate AI-enhanced pull requests with proper descriptions
- **Iterate on feedback** - Address PR review comments with AI assistance

## Installation

```bash
pnpm add -g @rotorsoft/gent
```

### Prerequisites

- **Node.js** 20 or higher
- **GitHub CLI** (`gh`) - [Install](https://cli.github.com/)
- **AI CLI** (one or more):
  - **Claude CLI** - [Install](https://claude.ai/code)
  - **Gemini CLI** - [Install](https://github.com/google-gemini/gemini-cli)
  - **Codex CLI** - [Install](https://github.com/openai/codex)

Verify prerequisites:
```bash
gh auth status    # Should show authenticated
claude --version  # Should show version (if using Claude)
gemini --version  # Should show version (if using Gemini)
codex --version  # Should show version (if using Codex)
```

## Quick Start

### 1. Initialize your repository

```bash
cd your-repo
gent init
```

This creates:
- `.gent.yml` - Configuration file
- `AGENT.md` - AI instructions for your project
- `progress.txt` - Progress tracking log

### 2. Setup GitHub labels

```bash
gent setup-labels
```

Creates workflow labels (`ai-ready`, `ai-in-progress`, etc.) and category labels.

### 3. Create a ticket

```bash
gent create "Add user authentication with JWT tokens"
```

The AI will:
- Generate a detailed issue with technical context
- Infer appropriate labels (type, priority, risk, area)
- Create the issue on GitHub with `ai-ready` label

### 4. Implement a ticket

```bash
# Pick a specific issue
gent run 123

# Or auto-select highest priority ai-ready issue
gent run --auto
```

The AI will:
- Create a feature branch
- Update labels to `ai-in-progress`
- Implement the feature following your `AGENT.md` instructions
- Run validation commands
- Create a commit
- Update labels to `ai-completed`

### 5. Create a pull request

```bash
gent pr
```

The AI will:
- Generate a PR description from commits and linked issue
- Include "Closes #" reference
- Create the PR on GitHub

### 6. Address review feedback

After reviewers leave comments on your PR:

```bash
gent fix
```

The AI will:
- Fetch all review comments and threads from the PR
- Filter to show only feedback since your last commit
- Present a summary of actionable feedback
- Re-run implementation with review context
- Auto-reply to addressed feedback comments

Repeat `gent fix` as needed until the PR is approved.

## Dashboard

Running `gent` with no arguments launches a dashboard that shows your current workflow at a glance:

```
 gent v2.0.0                                     Claude · gh

┌ Ticket ──────────────────────────────────────────────┐
│ #47  Add interactive TUI interface                   │
│  IN PROGRESS   type:feature  priority:high  area:ui  │
├ Branch ──────────────────────────────────────────────┤
│ ro/feature-47-add-interactive-tui                    │
│ 3 ahead  ·  ● uncommitted  ·  ● unpushed            │
├ Pull Request ────────────────────────────────────────┤
│ No PR created                                        │
├ Commits ─────────────────────────────────────────────┤
│ feat: add TUI state aggregation                      │
│ feat: add TUI display components                     │
└──────────────────────────────────────────────────────┘

  c  commit    p  create pr    r  continue impl    q  quit
 Commit your changes before creating a PR
```

The dashboard adapts to your current context:
- **On main branch** - offers to create new tickets or implement open issues
- **Uncommitted changes** - prompts to commit before other actions
- **No PR yet** - offers to create a pull request
- **PR with review feedback** - offers to fix review comments
- **UI changes with Playwright** - offers to record demo videos

You can also launch it explicitly with `gent ui`.

## Commands

### `gent init`

Initialize gent workflow in current repository.

```bash
gent init [--force]
```

Options:
- `-f, --force` - Overwrite existing configuration

### `gent setup-labels`

Setup GitHub labels for AI workflow.

```bash
gent setup-labels
```

Creates labels in these categories:
- **Workflow**: `ai-ready`, `ai-in-progress`, `ai-completed`, `ai-blocked`
- **Priority**: `priority:critical`, `priority:high`, `priority:medium`, `priority:low`
- **Risk**: `risk:low`, `risk:medium`, `risk:high`
- **Type**: `type:feature`, `type:fix`, `type:refactor`, `type:chore`, `type:docs`, `type:test`
- **Area**: `area:ui`, `area:api`, `area:database`, `area:workers`, `area:shared`, `area:testing`, `area:infra`

### `gent create <description>`

Create an AI-enhanced GitHub issue.

```bash
gent create "Add dark mode toggle to settings page"
gent create "Fix login bug" --provider gemini   # Use specific AI provider
```

Options:
- `-y, --yes` - Skip confirmation and create issue immediately
- `-p, --provider <provider>` - AI provider to use (`claude`, `gemini`, or `codex`)

### `gent list`

List GitHub issues by label/status.

```bash
gent list                          # Show ai-ready issues
gent list --status in-progress     # Show ai-in-progress issues
gent list --label priority:high    # Filter by label
gent list --status all --limit 50  # Show all issues
```

Options:
- `-l, --label <label>` - Filter by label
- `-s, --status <status>` - Filter by workflow status (ready, in-progress, completed, blocked, all)
- `-n, --limit <number>` - Maximum issues to show (default: 20)

### `gent run [issue-number]`

Run AI to implement a GitHub issue.

```bash
gent run 123                   # Implement issue #123
gent run --auto                # Auto-select highest priority ai-ready issue
gent run 123 --provider gemini # Use specific AI provider
```

Options:
- `-a, --auto` - Auto-select highest priority ai-ready issue
- `-p, --provider <provider>` - AI provider to use (`claude`, `gemini`, or `codex`)

### `gent pr`

Create an AI-enhanced pull request.

```bash
gent pr                      # Create PR
gent pr --draft              # Create as draft PR
gent pr --provider gemini    # Use specific AI provider
```

Options:
- `-d, --draft` - Create as draft PR
- `-p, --provider <provider>` - AI provider to use (`claude`, `gemini`, or `codex`)

### `gent fix`

Apply PR review feedback using AI.

```bash
gent fix                      # Address review comments on current PR
gent fix --provider gemini    # Use specific AI provider
```

The command:
1. Detects the PR associated with the current branch
2. Fetches all review comments, threads, and general PR comments
3. Filters to only show new feedback since your last commit (unresolved threads always shown)
4. Summarizes actionable feedback and displays it
5. Re-runs AI implementation with the review feedback context
6. Auto-replies to addressed feedback comments after successful fix

Options:
- `-p, --provider <provider>` - AI provider to use (`claude`, `gemini`, or `codex`)

### `gent status`

Show current workflow status.

```bash
gent status
```

Displays:
- Configuration status
- AI provider configuration
- Prerequisites check
- Git status (branch, commits, changes)
- Linked issue status
- PR status
- Suggested actions

### `gent ui`

Launch the interactive dashboard. Also available by running `gent` with no arguments.

```bash
gent ui
# or simply
gent
```

The dashboard displays panels for Ticket, Branch, Pull Request, and Commits with context-aware keyboard shortcuts at the bottom. Actions refresh the dashboard automatically after completion.

## Configuration

### .gent.yml

Main configuration file. Created by `gent init`.

```yaml
version: 1

github:
  labels:
    workflow:
      ready: "ai-ready"
      in_progress: "ai-in-progress"
      completed: "ai-completed"
      blocked: "ai-blocked"
    types: [feature, fix, refactor, chore, docs, test]
    priorities: [critical, high, medium, low]
    risks: [low, medium, high]
    areas: [ui, api, database, workers, shared, testing, infra]

branch:
  pattern: "{author}/{type}-{issue}-{slug}"
  author_source: "git"  # git | env | prompt
  author_env_var: "GENT_AUTHOR"

progress:
  file: "progress.txt"
  archive_threshold: 500
  archive_dir: ".gent/archive"

claude:
  permission_mode: "acceptEdits"
  agent_file: "AGENT.md"

gemini:
  sandbox_mode: "on"
  agent_file: "AGENT.md"

codex:
  agent_file: "AGENT.md"

ai:
  provider: "claude"           # claude | gemini | codex
  fallback_provider: "gemini"  # optional fallback when rate limited
  auto_fallback: true          # automatically switch to fallback on rate limit

validation:
  - "npm run typecheck"
  - "npm run lint"
  - "npm run test"
```

### AGENT.md

Project-specific instructions for the AI. This file tells the AI how to work with your codebase:

- Project overview and architecture
- Code patterns and conventions
- Testing requirements
- Commit conventions
- Important files to understand
- Constraints and limitations

See [templates/AGENT.md](templates/AGENT.md) for a full example.

### progress.txt

Append-only log that tracks AI implementation sessions. Each entry includes:

- Date and feature description
- Key implementation decisions
- Files changed
- Tests added
- Concerns for reviewers
- Commit hash

This provides context for future AI sessions and human reviewers.

## Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                          GENT WORKFLOW                          │
└─────────────────────────────────────────────────────────────────┘

     ┌──────────┐    gent create    ┌──────────┐
     │   Idea   │ ─────────────────>│  Issue   │
     └──────────┘                   │ ai-ready │
                                    └────┬─────┘
                                         │
                                    gent run
                                         │
                                         v
                                    ┌──────────┐
                                    │  Branch  │
                                    │ created  │
                                    └────┬─────┘
                                         │
                                    AI implements
                                         │
                                         v
                                    ┌──────────┐
                                    │  Issue   │
                                    │ai-complete│
                                    └────┬─────┘
                                         │
                                    gent pr
                                         │
                                         v
                                    ┌──────────┐
                                    │   PR     │
                                    │ created  │
                                    └────┬─────┘
                                         │
                                    Human review
                                         │
                              ┌──────────┴──────────┐
                              │                     │
                         Changes                Approved
                         requested                  │
                              │                     │
                         gent fix                   │
                              │                     │
                              v                     │
                         ┌──────────┐               │
                         │   AI     │               │
                         │  fixes   │───────────────┤
                         └────┬─────┘               │
                              │                     │
                              └─── (repeat if needed)
                                                    │
                                               Merge PR
                                                    │
                                                    v
                                               ┌──────────┐
                                               │  Issue   │
                                               │  closed  │
                                               └──────────┘
```

## Label Conventions

### Workflow Status

| Label | Description |
|-------|-------------|
| `ai-ready` | Issue ready for AI implementation |
| `ai-in-progress` | AI currently working on this |
| `ai-completed` | AI done, needs human review |
| `ai-blocked` | AI couldn't complete, needs help |

### Priority (Auto-selection order)

| Label | Description |
|-------|-------------|
| `priority:critical` | Blocking production |
| `priority:high` | Important features/bugs |
| `priority:medium` | Nice-to-have improvements |
| `priority:low` | Minor tweaks |

### Risk (Review depth)

| Label | Description |
|-------|-------------|
| `risk:low` | UI changes, tests, non-critical |
| `risk:medium` | API changes, new features |
| `risk:high` | Migrations, auth, security |

### Type (Branch prefix)

| Label | Branch Prefix |
|-------|---------------|
| `type:feature` | `feature-*` |
| `type:fix` | `fix-*` |
| `type:refactor` | `refactor-*` |
| `type:chore` | `chore-*` |
| `type:docs` | `docs-*` |
| `type:test` | `test-*` |

## Branch Naming

Default pattern: `{author}/{type}-{issue}-{slug}`

Examples:
- `ro/feature-123-add-user-auth`
- `jd/fix-456-button-alignment`
- `mb/refactor-789-api-endpoints`

The author is derived from:
1. `GENT_AUTHOR` environment variable (if `author_source: env`)
2. `git config user.initials` (if set)
3. Initials from `git config user.name` (e.g., "John Doe" → "jd")

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GENT_AUTHOR` | Override author initials for branch naming |
| `GENT_AI_PROVIDER` | Override AI provider (`claude`, `gemini`, or `codex`) |
| `DEBUG` | Enable debug output |

## Tips

### Writing Good Descriptions

```bash
# Good - specific and actionable
gent create "Add password reset functionality with email verification"

# Less good - too vague
gent create "Fix auth"
```

### Customizing for Your Project

1. **Edit AGENT.md** with your specific:
   - Architecture patterns
   - Naming conventions
   - Testing requirements
   - Important files

2. **Update .gent.yml** with your:
   - Custom area labels
   - Validation commands
   - Branch naming preferences

### Handling AI Blocks

If the AI gets stuck (`ai-blocked` label):
1. Check the issue comments for notes
2. Add clarifying information to the issue
3. Reset to `ai-ready` to retry
4. Or implement manually

### PR Review Iteration

The `gent fix` command streamlines the review cycle by allowing you to address feedback iteratively. It's particularly useful when you have multiple reviewers or several rounds of changes. The command intelligently ignores feedback you've already addressed in previous commits, keeping the AI focused only on what's currently pending.

```bash
# After creating a PR and receiving review feedback
gent fix                    # AI addresses the feedback
git push                    # Push the fixes

# If more feedback comes in later or new reviewers add comments
gent fix                    # AI only focuses on the NEW comments
git push                    # Push again
```

The command intelligently:
- Only shows feedback newer than your last commit to avoid redundant work.
- Always includes unresolved review threads to ensure every concern is addressed.
- Auto-replies to feedback comments after fixes are committed, closing the loop with reviewers.
- Works with any AI provider (Claude, Gemini, Codex).

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT
