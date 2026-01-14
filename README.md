# @rotorsoft/gent

AI-powered GitHub workflow CLI - leverage AI (Claude, Gemini, or Codex) to create tickets, implement features, and manage PRs.

## Overview

`gent` is a command-line tool that integrates AI with GitHub to automate your development workflow:

- **Create AI-enhanced tickets** - Describe what you need, the AI generates detailed GitHub issues with proper labels
- **Implement with AI** - Pick a ticket and let the AI implement it with automatic branch management
- **Track progress** - Maintain a progress log for context across AI sessions
- **Create smart PRs** - Generate AI-enhanced pull requests with proper descriptions

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
                                    Human review + merge
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

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT
