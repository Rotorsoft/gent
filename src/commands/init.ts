import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execa } from "execa";
import inquirer from "inquirer";
import { logger, colors } from "../utils/logger.js";
import { checkGitRepo } from "../utils/validators.js";
import {
  configExists,
  generateDefaultConfig,
  getConfigPath,
} from "../lib/config.js";
import { initializeProgress } from "../lib/progress.js";
import { loadConfig } from "../lib/config.js";
import { getRepoInfo } from "../lib/git.js";

const DEFAULT_GITIGNORE = `# Dependencies
node_modules/

# Build output
dist/

# Test coverage
coverage/

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Environment
.env
.env.local
.env.*.local

# Temporary files
*.tmp
*.temp
.cache/
`;

async function hasCommits(): Promise<boolean> {
  try {
    await execa("git", ["rev-parse", "HEAD"]);
    return true;
  } catch {
    return false;
  }
}

const DEFAULT_AGENT_MD = `# AI Agent Instructions

This file contains instructions for the AI when working on this repository.

## Project Overview

[Describe your project, its purpose, and key technologies used]

## Code Patterns

### Architecture
[Document your architecture - e.g., MVC, Clean Architecture, etc.]

### Naming Conventions
[Document naming conventions for files, functions, variables, etc.]

### Component Structure
[If applicable, describe component/module structure]

## Testing Requirements

### Unit Tests
- All new functions should have corresponding unit tests
- Use [your testing framework] for unit tests
- Aim for [X]% coverage on new code

### Integration Tests
[Document when and how to write integration tests]

## Commit Conventions

Follow conventional commits format:
- \`feat:\` New feature
- \`fix:\` Bug fix
- \`refactor:\` Code improvement without behavior change
- \`test:\` Testing additions
- \`chore:\` Maintenance/dependencies
- \`docs:\` Documentation

All AI commits should include the Co-Authored-By trailer as specified in the task prompt.

## Important Files

[List key files the AI should understand before making changes]

- \`src/index.ts\` - Main entry point
- \`src/config/\` - Configuration files
- [Add more key files]

## Constraints

- [List any constraints or limitations]
- [E.g., "Do not modify files in /vendor"]
- [E.g., "Always use async/await over callbacks"]
`;

export async function initCommand(options: { force?: boolean }): Promise<void> {
  logger.bold("Initializing gent workflow...");
  logger.newline();

  // Check if we're in a git repo
  const isGitRepo = await checkGitRepo();
  if (!isGitRepo) {
    logger.error("Not a git repository. Please run 'git init' first.");
    return;
  }

  const cwd = process.cwd();

  // Check if already initialized
  if (configExists(cwd) && !options.force) {
    const { overwrite } = await inquirer.prompt([
      {
        type: "confirm",
        name: "overwrite",
        message: "gent is already initialized. Overwrite existing config?",
        default: false,
      },
    ]);

    if (!overwrite) {
      logger.info("Initialization cancelled.");
      return;
    }
  }

  const { provider } = await inquirer.prompt([
    {
      type: "list",
      name: "provider",
      message: "Which AI provider would you like to use by default?",
      choices: ["claude", "gemini", "codex"],
      default: "claude",
    },
  ]);

  // Create .gitignore
  const gitignorePath = join(cwd, ".gitignore");
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, DEFAULT_GITIGNORE, "utf-8");
    logger.success(`Created ${colors.file(".gitignore")}`);
  } else {
    logger.info(`${colors.file(".gitignore")} already exists, skipping`);
  }

  // Create .gent.yml
  const configPath = getConfigPath(cwd);
  writeFileSync(configPath, generateDefaultConfig(provider), "utf-8");
  logger.success(`Created ${colors.file(".gent.yml")}`);

  // Create AGENT.md
  const agentPath = join(cwd, "AGENT.md");
  if (!existsSync(agentPath) || options.force) {
    writeFileSync(agentPath, DEFAULT_AGENT_MD, "utf-8");
    logger.success(`Created ${colors.file("AGENT.md")}`);
  } else {
    logger.info(`${colors.file("AGENT.md")} already exists, skipping`);
  }

  // Create progress.txt
  const config = loadConfig(cwd);
  initializeProgress(config, cwd);
  logger.success(`Created ${colors.file(config.progress.file)}`);

  // If the repo has no commits, create an initial commit with the gent config files
  if (!(await hasCommits())) {
    logger.newline();
    logger.info("No commits found. Creating initial commit with gent config...");
    await execa("git", ["add", ".gitignore", ".gent.yml", "AGENT.md", config.progress.file]);
    await execa("git", ["commit", "-m", "chore: initialize gent workflow"]);
    logger.success("Created initial commit");
  }

  // Check if a GitHub remote exists
  const repoInfo = await getRepoInfo();

  if (!repoInfo) {
    logger.newline();
    logger.box(
      "Setup Complete",
      `Next steps:
1. Edit ${colors.file("AGENT.md")} with your project-specific instructions
2. Edit ${colors.file(".gent.yml")} to customize settings
3. Create a GitHub remote: ${colors.command("gent github-remote")}
4. Run ${colors.command("gent setup-labels")} to create GitHub labels`
    );

    const { createRemote } = await inquirer.prompt([
      {
        type: "confirm",
        name: "createRemote",
        message: "No GitHub remote found. Would you like to create one now?",
        default: true,
      },
    ]);

    if (createRemote) {
      const { githubRemoteCommand } = await import("./github-remote.js");
      const success = await githubRemoteCommand();
      if (success) {
        // Remote created — now offer label setup
        const { setupLabels } = await inquirer.prompt([
          {
            type: "confirm",
            name: "setupLabels",
            message: "Would you like to setup GitHub labels now?",
            default: true,
          },
        ]);
        if (setupLabels) {
          const { setupLabelsCommand } = await import("./setup-labels.js");
          await setupLabelsCommand();
        }
      }
    }
  } else {
    logger.newline();
    logger.box(
      "Setup Complete",
      `Next steps:
1. Edit ${colors.file("AGENT.md")} with your project-specific instructions
2. Edit ${colors.file(".gent.yml")} to customize settings
3. Run ${colors.command("gent setup-labels")} to create GitHub labels
4. Run ${colors.command("gent create <description>")} to create your first ticket`
    );

    // Remote exists — offer label setup directly
    const { setupLabels } = await inquirer.prompt([
      {
        type: "confirm",
        name: "setupLabels",
        message: "Would you like to setup GitHub labels now?",
        default: true,
      },
    ]);

    if (setupLabels) {
      const { setupLabelsCommand } = await import("./setup-labels.js");
      await setupLabelsCommand();
    }
  }
}
