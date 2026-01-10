import { execa } from "execa";

export async function getCurrentBranch(): Promise<string> {
  const { stdout } = await execa("git", ["branch", "--show-current"]);
  return stdout.trim();
}

export async function isOnMainBranch(): Promise<boolean> {
  const branch = await getCurrentBranch();
  return branch === "main" || branch === "master";
}

export async function getDefaultBranch(): Promise<string> {
  try {
    const { stdout } = await execa("git", [
      "symbolic-ref",
      "refs/remotes/origin/HEAD",
    ]);
    return stdout.trim().replace("refs/remotes/origin/", "");
  } catch {
    // Fallback to checking if main or master exists
    try {
      await execa("git", ["rev-parse", "--verify", "main"]);
      return "main";
    } catch {
      return "master";
    }
  }
}

export async function branchExists(name: string): Promise<boolean> {
  try {
    await execa("git", ["rev-parse", "--verify", name]);
    return true;
  } catch {
    return false;
  }
}

export async function createBranch(name: string, from?: string): Promise<void> {
  if (from) {
    await execa("git", ["checkout", "-b", name, from]);
  } else {
    await execa("git", ["checkout", "-b", name]);
  }
}

export async function checkoutBranch(name: string): Promise<void> {
  await execa("git", ["checkout", name]);
}

export async function hasUncommittedChanges(): Promise<boolean> {
  const { stdout } = await execa("git", ["status", "--porcelain"]);
  return stdout.trim().length > 0;
}

export async function getUnpushedCommits(): Promise<boolean> {
  try {
    const { stdout } = await execa("git", [
      "log",
      "@{u}..HEAD",
      "--oneline",
    ]);
    return stdout.trim().length > 0;
  } catch {
    // No upstream set
    return true;
  }
}

export async function pushBranch(branch?: string): Promise<void> {
  const branchName = branch || (await getCurrentBranch());
  await execa("git", ["push", "-u", "origin", branchName]);
}

export async function getAuthorInitials(): Promise<string> {
  // Try git config user.initials first
  try {
    const { stdout } = await execa("git", ["config", "user.initials"]);
    if (stdout.trim()) {
      return stdout.trim();
    }
  } catch {
    // Not set, continue
  }

  // Fall back to deriving from user.name
  try {
    const { stdout } = await execa("git", ["config", "user.name"]);
    const name = stdout.trim();
    if (name) {
      // Extract initials from name (e.g., "John Doe" -> "jd")
      const parts = name.split(/\s+/);
      return parts.map((p) => p[0]?.toLowerCase() || "").join("");
    }
  } catch {
    // Not set
  }

  return "dev";
}

export async function getRepoInfo(): Promise<{
  owner: string;
  repo: string;
} | null> {
  try {
    const { stdout } = await execa("git", [
      "config",
      "--get",
      "remote.origin.url",
    ]);
    const url = stdout.trim();

    // Handle SSH format: git@github.com:owner/repo.git
    const sshMatch = url.match(/git@github\.com:([^/]+)\/([^.]+)/);
    if (sshMatch) {
      return { owner: sshMatch[1], repo: sshMatch[2] };
    }

    // Handle HTTPS format: https://github.com/owner/repo.git
    const httpsMatch = url.match(/github\.com\/([^/]+)\/([^.]+)/);
    if (httpsMatch) {
      return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }

    return null;
  } catch {
    return null;
  }
}

export async function getCommitsSinceBase(
  base: string = "main"
): Promise<string[]> {
  try {
    const { stdout } = await execa("git", [
      "log",
      `${base}..HEAD`,
      "--pretty=format:%s",
    ]);
    return stdout.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

export async function getDiffSummary(base: string = "main"): Promise<string> {
  try {
    const { stdout } = await execa("git", [
      "diff",
      `${base}...HEAD`,
      "--stat",
    ]);
    return stdout.trim();
  } catch {
    return "";
  }
}

export async function getCurrentCommitSha(): Promise<string> {
  const { stdout } = await execa("git", ["rev-parse", "HEAD"]);
  return stdout.trim();
}

export async function hasNewCommits(beforeSha: string): Promise<boolean> {
  const currentSha = await getCurrentCommitSha();
  return currentSha !== beforeSha;
}
