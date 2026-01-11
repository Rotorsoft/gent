import inquirer from "inquirer";
import { logger, colors } from "../utils/logger.js";
import { withSpinner } from "../utils/spinner.js";
import { loadConfig } from "../lib/config.js";
import { getIssue, createPullRequest, getPrForBranch, assignIssue, getCurrentUser } from "../lib/github.js";
import { buildPrPrompt } from "../lib/claude.js";
import { invokeAI, getProviderDisplayName } from "../lib/ai-provider.js";
import { getCurrentBranch, isOnMainBranch, getDefaultBranch, getCommitsSinceBase, getDiffSummary, getUnpushedCommits, pushBranch } from "../lib/git.js";
import { extractIssueNumber } from "../lib/branch.js";
import { checkGhAuth, checkAIProvider } from "../utils/validators.js";
import type { GitHubIssue, AIProvider } from "../types/index.js";

export interface PrOptions {
  draft?: boolean;
  provider?: AIProvider;
}

export async function prCommand(options: PrOptions): Promise<void> {
  logger.bold("Creating AI-enhanced pull request...");
  logger.newline();

  const config = loadConfig();

  // Determine which provider to use
  const provider = options.provider ?? config.ai.provider;
  const providerName = getProviderDisplayName(provider);

  // Validate prerequisites
  const [ghAuth, aiOk] = await Promise.all([
    checkGhAuth(),
    checkAIProvider(provider),
  ]);

  if (!ghAuth) {
    logger.error("Not authenticated with GitHub. Run 'gh auth login' first.");
    process.exit(1);
  }

  if (!aiOk) {
    logger.error(`${providerName} CLI not found. Please install ${provider} CLI first.`);
    process.exit(1);
  }

  // Check we're not on main
  if (await isOnMainBranch()) {
    logger.error("Cannot create PR from main/master branch.");
    process.exit(1);
  }

  // Check for existing PR
  const existingPr = await getPrForBranch();
  if (existingPr) {
    logger.warning(`A PR already exists for this branch: ${colors.url(existingPr.url)}`);
    return;
  }

  const currentBranch = await getCurrentBranch();
  const baseBranch = await getDefaultBranch();

  logger.info(`Branch: ${colors.branch(currentBranch)}`);
  logger.info(`Base: ${colors.branch(baseBranch)}`);

  // Check if we need to push
  const hasUnpushed = await getUnpushedCommits();
  if (hasUnpushed) {
    logger.warning("Branch has unpushed commits.");
    const { push } = await inquirer.prompt([
      {
        type: "confirm",
        name: "push",
        message: "Push to remote before creating PR?",
        default: true,
      },
    ]);

    if (push) {
      await withSpinner("Pushing branch...", async () => {
        await pushBranch();
      });
      logger.success("Branch pushed");
    }
  }

  // Extract issue number from branch
  const issueNumber = extractIssueNumber(currentBranch);
  let issue: GitHubIssue | null = null;

  if (issueNumber) {
    try {
      issue = await getIssue(issueNumber);
      logger.info(`Linked issue: ${colors.issue(`#${issueNumber}`)} - ${issue.title}`);
    } catch {
      logger.warning(`Could not fetch issue #${issueNumber}`);
    }
  } else {
    logger.warning("Could not extract issue number from branch name.");
  }

  // Get commits and diff
  const commits = await getCommitsSinceBase(baseBranch);
  const diffSummary = await getDiffSummary(baseBranch);

  if (commits.length === 0) {
    logger.error("No commits found since base branch.");
    return;
  }

  logger.info(`Commits: ${commits.length}`);
  logger.newline();

  // Generate PR description with AI
  const prompt = buildPrPrompt(issue, commits, diffSummary);

  let prBody: string;
  try {
    logger.info(`Generating PR description with ${colors.provider(providerName)}...`);
    logger.newline();
    const result = await invokeAI({ prompt, streamOutput: true }, config, options.provider);
    prBody = result.output;
    logger.newline();
  } catch (error) {
    logger.warning(`${providerName} invocation failed: ${error}`);
    // Fall back to basic description
    prBody = generateFallbackBody(issue, commits);
  }

  // Append signature footer
  prBody += `\n\n---\n*Created with ${providerName} by [gent](https://github.com/Rotorsoft/gent)*`;

  // Generate title
  const prTitle = issue?.title || commits[0] || currentBranch;

  // Create PR
  let prUrl: string;
  try {
    prUrl = await withSpinner("Creating pull request...", async () => {
      return createPullRequest({
        title: prTitle,
        body: prBody,
        base: baseBranch,
        draft: options.draft,
      });
    });
  } catch (error) {
    logger.error(`Failed to create PR: ${error}`);
    return;
  }

  // Assign issue to current user if linked
  if (issueNumber) {
    try {
      const user = await getCurrentUser();
      await assignIssue(issueNumber, user);
      logger.success(`Assigned issue #${issueNumber} to ${user}`);
    } catch {
      // Non-critical, ignore
    }
  }

  logger.newline();
  logger.success(`Pull request created!`);
  logger.newline();
  logger.highlight(prUrl);
  logger.newline();

  if (options.draft) {
    logger.dim("Created as draft. Mark as ready for review when done.");
  }
}

function generateFallbackBody(
  issue: GitHubIssue | null,
  commits: string[]
): string {
  let body = "## Summary\n\n";

  if (issue) {
    body += `Implements #${issue.number}: ${issue.title}\n\n`;
  }

  body += "## Changes\n\n";
  for (const commit of commits.slice(0, 10)) {
    body += `- ${commit}\n`;
  }

  body += "\n## Test Plan\n\n- [ ] Tests pass\n- [ ] Manual verification\n\n";

  if (issue) {
    body += `Closes #${issue.number}\n`;
  }

  return body;
}
