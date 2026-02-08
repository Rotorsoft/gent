# @rotorsoft/gent

[![CI](https://github.com/Rotorsoft/gent/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Rotorsoft/gent/actions/workflows/ci.yml) [![Release](https://github.com/Rotorsoft/gent/actions/workflows/release.yml/badge.svg?branch=main)](https://github.com/Rotorsoft/gent/actions/workflows/release.yml) [![npm version](https://img.shields.io/npm/v/@rotorsoft/gent)](https://www.npmjs.com/package/@rotorsoft/gent) [![npm downloads](https://img.shields.io/npm/dm/@rotorsoft/gent)](https://www.npmjs.com/package/@rotorsoft/gent) [![License](https://img.shields.io/npm/l/@rotorsoft/gent)](https://github.com/Rotorsoft/gent/blob/main/LICENSE) [![Node.js](https://img.shields.io/node/v/@rotorsoft/gent)](https://nodejs.org)

AI-powered GitHub workflow tool - leverage AI (Claude, Gemini, or Codex) to create tickets, implement features, and manage PRs from an interactive dashboard.


https://github.com/user-attachments/assets/c18fe01a-9695-4e8a-bf27-bb54f27247ef


## Overview

`gent` provides an interactive dashboard that integrates AI with GitHub to automate your development workflow. Just run `gent` to launch:

- **Dashboard at a glance** - See your current ticket, branch, PR, and commits in one view
- **Context-aware actions** - The dashboard adapts to your workflow state with relevant shortcuts
- **Create AI-enhanced tickets** - Describe what you need, the AI generates detailed GitHub issues
- **Implement with AI** - Select a ticket and let the AI implement it with automatic branch management
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
codex --version   # Should show version (if using Codex)
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

### 3. Launch the dashboard

```bash
gent
```

The dashboard is your primary interface. From here you can create tickets, switch between issues, run AI implementations, commit, push, and create PRs - all with single-key shortcuts.

## Dashboard

Running `gent` launches an interactive dashboard that shows your current workflow at a glance:

```
┌ gent v1.17.0 ────────────────────────────────────────┐
│ Provider: Claude                                     │
│ GitHub:   authenticated                              │
├ Ticket ──────────────────────────────────────────────┤
│ · #47  Add interactive TUI interface                 │
│   IN PROGRESS  type:feature  priority:high  area:ui  │
├ Branch ──────────────────────────────────────────────┤
│ · ro/feature-47-add-interactive-tui                  │
│   3 ahead  ·  ● uncommitted  ·  ● unpushed           │
├ Pull Request ────────────────────────────────────────┤
│   No PR created                                      │
├ Commits ─────────────────────────────────────────────┤
│ · feat: add TUI state aggregation                    │
│ · feat: add TUI display components                   │
├──────────────────────────────────────────────────────┤
│ new  commit  push  pr  run  list  refresh  ai  quit  │
└──────────────────────────────────────────────────────┘
```

### Dashboard Panels

- **Settings** - Shows AI provider, GitHub auth status, and update notifications
- **Ticket** - Current issue with labels, priority, and workflow status badges
- **Branch** - Current branch with sync status (ahead/uncommitted/unpushed/synced)
- **Pull Request** - PR state (open/draft/merged/closed), review decision, and actionable feedback count
- **Commits** - Recent commits on the current branch
- **Hint** - Contextual suggestion based on your workflow state

### Keyboard Shortcuts

The dashboard shows only the actions relevant to your current context:

| Key | Action | When Available |
|-----|--------|----------------|
| `n` | New ticket | Always |
| `c` | Commit changes | Uncommitted changes on feature branch |
| `s` | Push (send) to remote | Unpushed commits on feature branch |
| `p` | Create PR | Feature branch with commits, no PR yet |
| `r` | Run AI implementation | Feature branch with linked issue, PR not merged |
| `l` | List and switch tickets | Always |
| `f` | Refresh dashboard | Always |
| `a` | Switch AI provider | Always |
| `q` | Quit | Always |

### Context-Aware Behavior

The dashboard adapts to your current state:

- **On main branch** - Shows "ready to start new work"; use `n` to create a ticket or `l` to pick an existing one
- **Uncommitted changes** - Hints to commit before creating a PR
- **No PR yet** - Offers to create a pull request after commits are pushed
- **PR with review feedback** - Shows actionable comment count and hints to address feedback
- **UI changes with Playwright** - Notes that video capture is available

### Modal Dialogs

Actions that need input (commit, list, create, switch provider) open floating modal dialogs over the dashboard. Modals support:

- **Select** - Arrow keys to navigate, Enter to confirm, Escape to cancel
- **Confirm** - y/n to confirm or cancel
- **Input** - Type text, Enter to submit, Escape to cancel
- **Multiline input** - For ticket descriptions; Enter for newline, Ctrl+S to submit

### Typical Workflow from the Dashboard

1. Press `n` to create a new ticket (describe the feature in the multiline input)
2. Press `l` to list tickets and switch to the new one (creates a branch automatically)
3. Press `r` to run AI implementation (opens an interactive AI session)
4. Press `c` to commit (choose AI-generated or manual commit message)
5. Press `s` to send (push) to remote
6. Press `p` to create a pull request
7. After review feedback, press `r` again to address comments (review context is included automatically)

## Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                          GENT WORKFLOW                          │
└─────────────────────────────────────────────────────────────────┘

     ┌──────────┐    n (new)        ┌──────────┐
     │   Idea   │ ─────────────────>│  Issue   │
     └──────────┘                   │ ai-ready │
                                    └────┬─────┘
                                         │
                                    l (list) → select
                                         │
                                         v
                                    ┌──────────┐
                                    │  Branch  │
                                    │ created  │
                                    └────┬─────┘
                                         │
                                    r (run)
                                         │
                                         v
                                    ┌──────────┐
                                    │  Issue   │
                                    │ai-complete│
                                    └────┬─────┘
                                         │
                                    c (commit) → s (send) → p (pr)
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
                         r (run)                    │
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

## CLI Reference

All dashboard actions map to CLI commands that can also be run directly. This is useful for scripting, CI pipelines, or if you prefer a command-driven workflow.

### `gent`

Launch the interactive dashboard (default when no command is given).

```bash
gent
# or explicitly
gent ui
```

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

Create an AI-enhanced GitHub issue (dashboard: `n`).

```bash
gent create "Add dark mode toggle to settings page"
gent create "Fix login bug" --provider gemini
```

Options:
- `-y, --yes` - Skip confirmation and create issue immediately
- `-p, --provider <provider>` - AI provider to use (`claude`, `gemini`, or `codex`)

### `gent list`

List and switch between GitHub issues (dashboard: `l`).

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

Run AI to implement a GitHub issue (dashboard: `r`).

```bash
gent run 123                   # Implement issue #123
gent run 123 --provider gemini # Use specific AI provider
```

Options:
- `-p, --provider <provider>` - AI provider to use (`claude`, `gemini`, or `codex`)

### `gent pr`

Create an AI-enhanced pull request (dashboard: `p`).

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

Show current workflow status (useful for scripting and debugging).

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
3. Initials from `git config user.name` (e.g., "John Doe" -> "jd")

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GENT_AUTHOR` | Override author initials for branch naming |
| `GENT_AI_PROVIDER` | Override AI provider (`claude`, `gemini`, or `codex`) |
| `GENT_SKIP_UPDATE_CHECK` | Set to `1` to disable update notifications |
| `DEBUG` | Enable debug output |

## Tips

### Writing Good Descriptions

When creating tickets (via `n` in the dashboard or `gent create`):

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

After receiving review feedback, press `r` in the dashboard (or run `gent fix` from the CLI) to address comments. The AI automatically includes review context and only focuses on new feedback since your last commit. Unresolved threads are always included regardless of age.

```bash
# CLI equivalent for review iteration
gent fix                    # AI addresses the feedback
git push                    # Push the fixes

# If more feedback comes in
gent fix                    # AI only focuses on NEW comments
git push                    # Push again
```

### Dashboard vs CLI

The dashboard (`gent`) is the recommended way to use gent. It provides:
- A unified view of your workflow state
- Context-aware actions (only shows what's relevant)
- Modal dialogs for input (no need to remember command flags)
- Automatic refresh after actions

CLI commands are available for:
- Scripting and automation (`gent create --yes "..."`)
- CI/CD pipelines
- Users who prefer a command-driven workflow
- Advanced filtering (`gent list --status all --label priority:high`)

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT
