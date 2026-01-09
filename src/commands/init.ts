import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import inquirer from "inquirer";
import { logger, colors } from "../utils/logger.js";
import { checkGitRepo } from "../utils/validators.js";
import { configExists, generateDefaultConfig, getConfigPath } from "../lib/config.js";
import { initializeProgress } from "../lib/progress.js";
import { loadConfig } from "../lib/config.js";

const DEFAULT_AGENT_MD = `# AI Agent Instructions

This file contains instructions for Claude when working on this repository.

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

All AI commits should include:
\`\`\`
Co-Authored-By: Claude <noreply@anthropic.com>
\`\`\`

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
    process.exit(1);
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

  // Create .gent.yml
  const configPath = getConfigPath(cwd);
  writeFileSync(configPath, generateDefaultConfig(), "utf-8");
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

  logger.newline();
  logger.box("Setup Complete", `Next steps:
1. Edit ${colors.file("AGENT.md")} with your project-specific instructions
2. Edit ${colors.file(".gent.yml")} to customize settings
3. Run ${colors.command("gent setup-labels")} to create GitHub labels
4. Run ${colors.command("gent create <description>")} to create your first ticket`);

  // Ask about setting up labels
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
