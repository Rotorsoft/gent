import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { GentConfig, ProgressEntry } from "../types/index.js";

export function getProgressPath(
  config: GentConfig,
  cwd: string = process.cwd()
): string {
  return join(cwd, config.progress.file);
}

export function progressExists(
  config: GentConfig,
  cwd: string = process.cwd()
): boolean {
  return existsSync(getProgressPath(config, cwd));
}

export function readProgress(
  config: GentConfig,
  cwd: string = process.cwd()
): string {
  const path = getProgressPath(config, cwd);
  if (!existsSync(path)) {
    return "";
  }
  return readFileSync(path, "utf-8");
}

export function appendProgress(
  config: GentConfig,
  entry: ProgressEntry,
  cwd: string = process.cwd()
): void {
  const path = getProgressPath(config, cwd);
  const content = formatProgressEntry(entry);

  // Ensure directory exists
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Read existing content
  let existing = "";
  if (existsSync(path)) {
    existing = readFileSync(path, "utf-8");
  }

  // Check if we need to archive
  const lines = existing.split("\n").length;
  if (lines > config.progress.archive_threshold) {
    archiveProgress(config, existing, cwd);
    existing = `# Progress Log (archived previous entries)\n\n`;
  }

  // Append new entry
  writeFileSync(path, existing + content, "utf-8");
}

export function formatProgressEntry(entry: ProgressEntry): string {
  let content = `\n[${entry.date}] ${entry.type}: ${entry.description}\n`;

  if (entry.issue) {
    content += `- Completed GitHub issue #${entry.issue}\n`;
  }

  if (entry.decisions.length > 0) {
    content += `- Key implementation decisions:\n`;
    for (const decision of entry.decisions) {
      content += `  * ${decision}\n`;
    }
  }

  if (entry.files.length > 0) {
    content += `- Files changed:\n`;
    for (const file of entry.files) {
      content += `  * ${file}\n`;
    }
  }

  if (entry.tests.length > 0) {
    content += `- Tests: ${entry.tests.join(", ")}\n`;
  }

  if (entry.concerns.length > 0) {
    content += `- Concerns for reviewers:\n`;
    for (const concern of entry.concerns) {
      content += `  * ${concern}\n`;
    }
  }

  if (entry.followUp.length > 0) {
    content += `- Follow-up tasks:\n`;
    for (const task of entry.followUp) {
      content += `  * ${task}\n`;
    }
  }

  if (entry.commit) {
    content += `- Commit: ${entry.commit}\n`;
  }

  return content;
}

function archiveProgress(
  config: GentConfig,
  content: string,
  cwd: string
): void {
  const archiveDir = join(cwd, config.progress.archive_dir);

  if (!existsSync(archiveDir)) {
    mkdirSync(archiveDir, { recursive: true });
  }

  const date = new Date().toISOString().split("T")[0];
  const archivePath = join(archiveDir, `progress-${date}.txt`);

  writeFileSync(archivePath, content, "utf-8");
}

export function initializeProgress(
  config: GentConfig,
  cwd: string = process.cwd()
): void {
  const path = getProgressPath(config, cwd);

  if (existsSync(path)) {
    return;
  }

  const initialContent = `# Progress Log

This file tracks AI-assisted development progress.
Each entry documents: date, feature, decisions, files changed, tests, and concerns.

---
`;

  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(path, initialContent, "utf-8");
}

export function getRecentProgress(
  config: GentConfig,
  cwd: string = process.cwd(),
  maxLines: number = 100
): string {
  const content = readProgress(config, cwd);
  const lines = content.split("\n");

  if (lines.length <= maxLines) {
    return content;
  }

  return lines.slice(-maxLines).join("\n");
}
