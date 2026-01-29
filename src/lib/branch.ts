import type { GentConfig, BranchInfo } from "../types/index.js";
import { getAuthorInitials } from "./git.js";
import { sanitizeSlug } from "../utils/validators.js";

export async function generateBranchName(
  config: GentConfig,
  issueNumber: number,
  issueTitle: string,
  type: string
): Promise<string> {
  const author = await resolveAuthor(config);
  const slug = sanitizeSlug(issueTitle);

  return config.branch.pattern
    .replace("{author}", author)
    .replace("{type}", type)
    .replace("{issue}", String(issueNumber))
    .replace("{slug}", slug);
}

async function resolveAuthor(config: GentConfig): Promise<string> {
  switch (config.branch.author_source) {
    case "env": {
      const envValue = process.env[config.branch.author_env_var];
      if (envValue) {
        return envValue;
      }
      // Fall through to git
      return getAuthorInitials();
    }
    case "git":
    default:
      return getAuthorInitials();
  }
}

export function parseBranchName(branchName: string): BranchInfo | null {
  // Pattern 1: author/type-issue-slug (e.g., ro/feature-123-add-login)
  const pattern1 =
    /^([^/]+)\/(feature|fix|refactor|chore|docs|test)-(\d+)-(.+)$/;
  const match1 = branchName.match(pattern1);
  if (match1) {
    return {
      name: branchName,
      author: match1[1],
      type: match1[2],
      issueNumber: parseInt(match1[3], 10),
      slug: match1[4],
    };
  }

  // Pattern 2: type/issue-slug (e.g., feature/123-add-login)
  const pattern2 = /^(feature|fix|refactor|chore|docs|test)\/(\d+)-(.+)$/;
  const match2 = branchName.match(pattern2);
  if (match2) {
    return {
      name: branchName,
      author: "",
      type: match2[1],
      issueNumber: parseInt(match2[2], 10),
      slug: match2[3],
    };
  }

  // Pattern 3: issue-slug (e.g., 123-add-login)
  const pattern3 = /^(\d+)-(.+)$/;
  const match3 = branchName.match(pattern3);
  if (match3) {
    return {
      name: branchName,
      author: "",
      type: "feature",
      issueNumber: parseInt(match3[1], 10),
      slug: match3[2],
    };
  }

  // Pattern 4: Just look for issue number anywhere
  const issueMatch = branchName.match(/(\d+)/);
  if (issueMatch) {
    return {
      name: branchName,
      author: "",
      type: "feature",
      issueNumber: parseInt(issueMatch[1], 10),
      slug: branchName,
    };
  }

  return null;
}

export function extractIssueNumber(branchName: string): number | null {
  const info = parseBranchName(branchName);
  return info?.issueNumber ?? null;
}
