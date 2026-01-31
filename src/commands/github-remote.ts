import { execa } from "execa";
import { logger } from "../utils/logger.js";
import { getCurrentBranch } from "../lib/git.js";
import { checkGhAuth } from "../utils/validators.js";

export async function githubRemoteCommand(): Promise<boolean> {
  const isAuthenticated = await checkGhAuth();
  if (!isAuthenticated) {
    logger.error("GitHub CLI is not authenticated. Run: gh auth login");
    return false;
  }

  try {
    // Check if remote origin already exists
    try {
      const { stdout } = await execa("git", [
        "config",
        "--get",
        "remote.origin.url",
      ]);
      if (stdout.trim()) {
        logger.error("Remote origin already exists: " + stdout.trim());
        return false;
      }
    } catch {
      // No remote origin — expected
    }

    // Create a GitHub repo using gh CLI (uses current directory name)
    logger.info("Creating GitHub repository...");
    await execa("gh", ["repo", "create", "--source=.", "--push", "--private"]);

    const branch = await getCurrentBranch();
    logger.success(`Repository created and ${branch} pushed to GitHub`);
    return true;
  } catch (error) {
    logger.error(`Failed to create remote: ${error}`);
    return false;
  }
}
