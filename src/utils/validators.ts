import { execa } from "execa";

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

export async function checkGitRepo(): Promise<boolean> {
  try {
    await execa("git", ["rev-parse", "--git-dir"]);
    return true;
  } catch {
    return false;
  }
}

export async function validatePrerequisites(): Promise<{
  valid: boolean;
  missing: string[];
}> {
  const checks = [
    { name: "gh CLI", check: checkGhCli },
    { name: "gh auth", check: checkGhAuth },
    { name: "claude CLI", check: checkClaudeCli },
    { name: "git repository", check: checkGitRepo },
  ];

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
