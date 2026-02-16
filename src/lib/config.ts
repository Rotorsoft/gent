import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { GentConfig, AIProvider } from "../types/index.js";
import { DEFAULT_PROMPTS, interpolate } from "./default-prompts.js";

// Module-level variable to hold runtime provider override (e.g. from TUI)
let runtimeProvider: AIProvider | null = null;

export function setRuntimeProvider(provider: AIProvider): void {
  runtimeProvider = provider;
}

/**
 * Helper to resolve the active provider based on precedence:
 * 1. CLI options (explicit flag)
 * 2. Runtime override (in-memory state)
 * 3. Environment variable (GENT_AI_PROVIDER)
 * 4. Configuration (file)
 * 5. Default
 */
export function resolveProvider(
  options: { provider?: AIProvider } | undefined,
  config: GentConfig
): AIProvider {
  return options?.provider ?? config.ai.provider;
}

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
  gemini: {
    sandbox_mode: "on",
    agent_file: "AGENT.md",
  },
  codex: {
    agent_file: "AGENT.md",
  },
  ai: {
    provider: "claude",
    auto_fallback: true,
  },
  video: {
    enabled: true,
    max_duration: 30,
    width: 1280,
    height: 720,
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

export function getPromptsFilePath(cwd: string = process.cwd()): string {
  return join(cwd, ".gent-prompts.yml");
}

function loadPromptsFile(cwd: string): Record<string, string> {
  const promptsPath = getPromptsFilePath(cwd);
  if (!existsSync(promptsPath)) return {};
  try {
    const content = readFileSync(promptsPath, "utf-8");
    const parsed = parseYaml(content);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
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

/**
 * Get a prompt template by key, with user overrides from .gent-prompts.yml
 * merged over defaults. Performs variable interpolation on the result.
 */
export function getPrompt(
  key: string,
  variables: Record<string, string>,
  cwd: string = process.cwd()
): string {
  const overrides = loadPromptsFile(cwd);
  const template = overrides[key] ?? DEFAULT_PROMPTS[key];
  if (!template) {
    throw new Error(`Unknown prompt key: ${key}`);
  }
  return interpolate(template, variables);
}

export function loadAgentInstructions(
  cwd: string = process.cwd()
): string | null {
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
  const envProvider = process.env.GENT_AI_PROVIDER as
    | "claude"
    | "gemini"
    | "codex"
    | undefined;

  // Runtime override takes precedence over env var
  const effectiveProvider = runtimeProvider ?? envProvider;

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
    gemini: {
      ...defaults.gemini,
      ...user.gemini,
    },
    codex: {
      ...defaults.codex,
      ...user.codex,
    },
    ai: {
      ...defaults.ai,
      ...user.ai,
      // Runtime/Env takes precedence
      ...(effectiveProvider && { provider: effectiveProvider }),
    },
    video: {
      ...defaults.video,
      ...user.video,
    },
    validation: user.validation ?? defaults.validation,
  };
}

export function updateConfigProvider(
  provider: AIProvider,
  cwd: string = process.cwd()
): void {
  const configPath = getConfigPath(cwd);
  if (!existsSync(configPath)) {
    writeFileSync(configPath, generateDefaultConfig(provider), "utf-8");
    return;
  }
  const content = readFileSync(configPath, "utf-8");
  const updated = content.replace(
    /^(\s*provider:\s*)"[^"]*"/m,
    `$1"${provider}"`
  );
  writeFileSync(configPath, updated, "utf-8");
}

export function generateDefaultConfig(provider: AIProvider = "claude"): string {
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

# Gemini settings
gemini:
  sandbox_mode: "on"
  agent_file: "AGENT.md"

# Codex settings
codex:
  agent_file: "AGENT.md"

# AI provider settings
ai:
  provider: "${provider}"  # claude | gemini | codex
  # fallback_provider: "gemini"  # optional fallback when rate limited
  auto_fallback: true  # automatically switch to fallback on rate limit

# Video capture for UI changes (requires Playwright)
video:
  enabled: true  # set to false to disable video capture for PRs with UI changes
  max_duration: 30  # maximum video duration in seconds
  width: 1280  # video width
  height: 720  # video height

# Validation commands (run before commit)
validation:
  - "npm run typecheck"
  - "npm run lint"
  - "npm run test"
`;
}

/**
 * Generate a .gent-prompts.yml file with all built-in prompt templates.
 * Each prompt is documented with its available variables.
 */
export function generateDefaultPromptsFile(): string {
  const variableDocs: Record<string, string> = {
    ticket: `# Variables: {description}, {agent_instructions_section}, {additional_hints_section}`,
    implementation: `# Variables: {issue_number}, {issue_title}, {issue_body}, {agent_instructions_section},
#   {progress_section}, {extra_context_section}, {validation_commands},
#   {provider_name}, {provider_email}, {progress_file}`,
    pr: `# Variables: {issue_section}, {commits}, {diff_summary}, {close_reference}`,
    commit_message: `# Variables: {issue_context}, {diff}`,
    commit: `# Variables: {issue_context}, {provider_name}, {provider_email}`,
    video: `# Variables: {issue_number}, {issue_title}, {agent_instructions_section},
#   {max_duration}, {width}, {height}`,
    pr_video: `# Variables: {max_duration}`,
  };

  let output = `# Gent Prompt Templates
# Override any prompt by uncommenting and editing it.
# Templates use {variable_name} syntax for interpolation.
# See https://github.com/rotorsoft/gent for documentation
`;

  for (const [key, template] of Object.entries(DEFAULT_PROMPTS)) {
    const docs = variableDocs[key] || "";
    output += `\n# --- ${key} ---\n`;
    if (docs) output += `${docs}\n`;
    output += `# ${key}: |\n`;
    for (const line of template.split("\n")) {
      output += `#   ${line}\n`;
    }
  }

  return output;
}
