import { execa } from "execa";

// UI file patterns that indicate UI changes
const UI_FILE_PATTERNS = [
  /\.(tsx|jsx)$/,
  /\.(vue|svelte)$/,
  /\.css$/,
  /\.scss$/,
  /\.less$/,
  /\.styled\.(ts|js)$/,
  /components?\//i,
  /pages?\//i,
  /views?\//i,
  /layouts?\//i,
  /ui\//i,
  /styles?\//i,
];

/**
 * Check if Playwright is available (installed locally or globally).
 */
export async function isPlaywrightAvailable(): Promise<boolean> {
  try {
    const { exitCode } = await execa("npx", ["playwright", "--version"], {
      reject: false,
    });
    return exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Detect if the changed files indicate UI changes
 */
export function hasUIChanges(changedFiles: string[]): boolean {
  return changedFiles.some((file) =>
    UI_FILE_PATTERNS.some((pattern) => pattern.test(file))
  );
}

/**
 * Get list of changed files from git diff
 */
export async function getChangedFiles(
  baseBranch: string = "main"
): Promise<string[]> {
  try {
    const { stdout } = await execa("git", [
      "diff",
      `${baseBranch}...HEAD`,
      "--name-only",
    ]);
    return stdout.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}
