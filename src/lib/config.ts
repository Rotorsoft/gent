import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { GentConfig } from "../types/index.js";

const DEFAULT_CONFIG: GentConfig = {
  version: 1,
  github: {
    labels: {
      workflow: {
        ready: "ai-ready",
        in_progress: "ai-in-progress",
        completed: "ai-completed",
        blocked: "ai-blocked",
      },
      types: ["feature", "fix", "refactor", "chore", "docs", "test"],
      priorities: ["critical", "high", "medium", "low"],
      risks: ["low", "medium", "high"],
      areas: ["ui", "api", "database", "workers", "shared", "testing", "infra"],
    },
  },
  branch: {
    pattern: "{author}/{type}-{issue}-{slug}",
    author_source: "git",
    author_env_var: "GENT_AUTHOR",
  },
  progress: {
    file: "progress.txt",
    archive_threshold: 500,
    archive_dir: ".gent/archive",
  },
  claude: {
    permission_mode: "acceptEdits",
    agent_file: "AGENT.md",
  },
  ai: {
    provider: "claude",
    auto_fallback: true,
  },
  validation: ["npm run typecheck", "npm run lint", "npm run test"],
};

export function getConfigPath(cwd: string = process.cwd()): string {
  return join(cwd, ".gent.yml");
}

export function getAgentPath(cwd: string = process.cwd()): string | null {
  const config = loadConfig(cwd);
  // Use claude.agent_file for backward compatibility
  const agentPath = join(cwd, config.claude.agent_file);
  return existsSync(agentPath) ? agentPath : null;
}

export function loadConfig(cwd: string = process.cwd()): GentConfig {
  const configPath = getConfigPath(cwd);

  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const userConfig = parseYaml(content) as Partial<GentConfig>;

    return mergeConfig(DEFAULT_CONFIG, userConfig);
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function loadAgentInstructions(cwd: string = process.cwd()): string | null {
  const agentPath = getAgentPath(cwd);

  if (!agentPath) {
    return null;
  }

  try {
    return readFileSync(agentPath, "utf-8");
  } catch {
    return null;
  }
}

export function configExists(cwd: string = process.cwd()): boolean {
  return existsSync(getConfigPath(cwd));
}

function mergeConfig(
  defaults: GentConfig,
  user: Partial<GentConfig>
): GentConfig {
  // Support GENT_AI_PROVIDER environment variable override
  const envProvider = process.env.GENT_AI_PROVIDER as "claude" | "gemini" | undefined;

  return {
    version: user.version ?? defaults.version,
    github: {
      labels: {
        workflow: {
          ...defaults.github.labels.workflow,
          ...user.github?.labels?.workflow,
        },
        types: user.github?.labels?.types ?? defaults.github.labels.types,
        priorities:
          user.github?.labels?.priorities ?? defaults.github.labels.priorities,
        risks: user.github?.labels?.risks ?? defaults.github.labels.risks,
        areas: user.github?.labels?.areas ?? defaults.github.labels.areas,
      },
    },
    branch: {
      ...defaults.branch,
      ...user.branch,
    },
    progress: {
      ...defaults.progress,
      ...user.progress,
    },
    claude: {
      ...defaults.claude,
      ...user.claude,
    },
    ai: {
      ...defaults.ai,
      ...user.ai,
      // Environment variable takes precedence
      ...(envProvider && { provider: envProvider }),
    },
    validation: user.validation ?? defaults.validation,
  };
}

export function generateDefaultConfig(): string {
  return `# Gent Configuration
# See https://github.com/rotorsoft/gent for documentation
version: 1

# GitHub settings
github:
  labels:
    workflow:
      ready: "ai-ready"
      in_progress: "ai-in-progress"
      completed: "ai-completed"
      blocked: "ai-blocked"
    types:
      - feature
      - fix
      - refactor
      - chore
      - docs
      - test
    priorities:
      - critical
      - high
      - medium
      - low
    risks:
      - low
      - medium
      - high
    areas:
      - ui
      - api
      - database
      - workers
      - shared
      - testing
      - infra

# Branch naming convention
branch:
  pattern: "{author}/{type}-{issue}-{slug}"
  author_source: "git"  # git | env | prompt
  author_env_var: "GENT_AUTHOR"

# Progress tracking
progress:
  file: "progress.txt"
  archive_threshold: 500
  archive_dir: ".gent/archive"

# Claude settings
claude:
  permission_mode: "acceptEdits"
  agent_file: "AGENT.md"

# AI provider settings
ai:
  provider: "claude"  # claude | gemini
  # fallback_provider: "gemini"  # optional fallback when rate limited
  auto_fallback: true  # automatically switch to fallback on rate limit

# Validation commands (run before commit)
validation:
  - "npm run typecheck"
  - "npm run lint"
  - "npm run test"
`;
}
