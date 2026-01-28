# AI Agent Instructions

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
pnpm install          # Install dependencies
pnpm run build        # Build with tsup (outputs to dist/)
pnpm run dev          # Run CLI directly with tsx (no build needed)
pnpm run watch        # Build in watch mode
pnpm run typecheck    # Run TypeScript type checking
pnpm run lint         # Run ESLint
pnpm run lint:fix     # Fix ESLint issues
pnpm run format       # Format with Prettier
pnpm test             # Run all tests
pnpm run test:watch   # Run tests in watch mode
pnpm vitest src/lib/branch.test.ts  # Run a single test file
```

## Architecture

This is a TypeScript CLI tool (`gent`) that integrates AI (Claude, Gemini, or Codex) with GitHub for automated development workflows. It requires the `gh` CLI and `claude`, `gemini`, or `codex` CLI as external dependencies.

### Entry Point and Commands

- `src/index.ts` - CLI entry point using Commander.js, defines all commands. Running with no args launches the dashboard.
- `src/commands/` - Each command (init, create, list, run, pr, status, setup-labels, tui) has its own file
- `src/tui/` - Dashboard components: state aggregation, context-aware actions, panel rendering

### Core Libraries

- `src/lib/config.ts` - Loads `.gent.yml` config and `AGENT.md` instructions
- `src/lib/github.ts` - GitHub operations via `gh` CLI (issues, labels, PRs)
- `src/lib/ai-provider.ts` - AI provider abstraction (Claude/Gemini/Codex), handles invocation and fallback
- `src/lib/prompts.ts` - Prompt building for AI interactions
- `src/lib/git.ts` - Git operations via `execa`
- `src/lib/branch.ts` - Branch name parsing and generation (pattern: `{author}/{type}-{issue}-{slug}`)
- `src/lib/labels.ts` - Label utilities, priority sorting, metadata extraction
- `src/lib/progress.ts` - Append-only progress.txt management

### Types

- `src/types/index.ts` - All TypeScript interfaces (`GentConfig`, `GitHubIssue`, `BranchInfo`, etc.) and `DEFAULT_LABELS` constant

### Utilities

- `src/utils/logger.ts` - Colored console output with chalk
- `src/utils/spinner.ts` - Progress spinners with ora
- `src/utils/validators.ts` - Prerequisite checks (gh, claude, gemini, codex, git) and input validation

## Key Patterns

- External CLI tools (`gh`, `claude`, `gemini`, `codex`, `git`) are invoked via `execa`
- Config is loaded from `.gent.yml` with defaults merged in
- AI provider is configurable (Claude/Gemini/Codex) with optional auto-fallback on rate limits
- All GitHub operations use the `gh` CLI (not direct API calls)
- Branch names follow pattern: `{author}/{type}-{issue}-{slug}` (e.g., `ro/feature-123-add-login`)
- Workflow labels: `ai-ready` → `ai-in-progress` → `ai-completed` (or `ai-blocked`)

## Testing

Tests use Vitest and are co-located with source files as `*.test.ts`. Test pure functions in lib/ and utils/ - commands are harder to test as they invoke external CLIs.
