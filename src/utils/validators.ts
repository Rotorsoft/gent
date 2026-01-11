import { execa } from "execa";
import type { GentConfig, AIProvider } from "../types/index.js";

export async function checkGhCli(): Promise<boolean> {
  try {
    await execa("gh", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

export async function checkGhAuth(): Promise<boolean> {
  try {
    await execa("gh", ["auth", "status"]);
    return true;
  } catch {
    return false;
  }
}

export async function checkClaudeCli(): Promise<boolean> {
  try {
    await execa("claude", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

export async function checkGeminiCli(): Promise<boolean> {
  try {
    await execa("gemini", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

export async function checkAIProvider(provider: AIProvider): Promise<boolean> {
  return provider === "claude" ? checkClaudeCli() : checkGeminiCli();
}

export async function checkGitRepo(): Promise<boolean> {
  try {
    await execa("git", ["rev-parse", "--git-dir"]);
    return true;
  } catch {
    return false;
  }
}

export async function validatePrerequisites(config?: GentConfig): Promise<{
  valid: boolean;
  missing: string[];
}> {
  const checks = [
    { name: "gh CLI", check: checkGhCli },
    { name: "gh auth", check: checkGhAuth },
    { name: "git repository", check: checkGitRepo },
  ];

  // Add AI provider check based on config
  if (config) {
    const provider = config.ai.provider;
    const providerName = provider === "claude" ? "claude CLI" : "gemini CLI";
    checks.push({
      name: providerName,
      check: () => checkAIProvider(provider),
    });

    // Also check fallback if configured
    if (config.ai.fallback_provider) {
      const fallback = config.ai.fallback_provider;
      const fallbackName = fallback === "claude" ? "claude CLI (fallback)" : "gemini CLI (fallback)";
      checks.push({
        name: fallbackName,
        check: () => checkAIProvider(fallback),
      });
    }
  } else {
    // Default to checking claude for backward compatibility
    checks.push({ name: "claude CLI", check: checkClaudeCli });
  }

  const missing: string[] = [];

  for (const { name, check } of checks) {
    const passed = await check();
    if (!passed) {
      missing.push(name);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

export function isValidIssueNumber(value: string): boolean {
  const num = parseInt(value, 10);
  return !isNaN(num) && num > 0;
}

export function sanitizeSlug(title: string, maxLength = 40): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
}
