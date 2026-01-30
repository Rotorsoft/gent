import { logger, colors } from "../utils/logger.js";
import { withSpinner } from "../utils/spinner.js";
import { loadConfig } from "../lib/config.js";
import {
  getIssue,
  createPullRequest,
  getPrForBranch,
  assignIssue,
  getCurrentUser,
  updateIssueLabels,
} from "../lib/github.js";
import { buildPrPrompt } from "../lib/prompts.js";
import { invokeAI, getProviderDisplayName } from "../lib/ai-provider.js";
import {
  getCurrentBranch,
  isOnMainBranch,
  getDefaultBranch,
  getCommitsSinceBase,
  getDiffSummary,
  getUnpushedCommits,
  pushBranch,
} from "../lib/git.js";
import { extractIssueNumber } from "../lib/branch.js";
import { getWorkflowLabels } from "../lib/labels.js";
import { checkGhAuth, checkAIProvider } from "../utils/validators.js";
import {
  isPlaywrightAvailable,
  hasUIChanges,
  getChangedFiles,
} from "../lib/playwright.js";
import type { GitHubIssue, AIProvider } from "../types/index.js";

export interface PrOptions {
  draft?: boolean;
  provider?: AIProvider;
  video?: boolean;
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
    return;
  }

  if (!aiOk) {
    logger.error(
      `${providerName} CLI not found. Please install ${provider} CLI first.`
    );
    return;
  }

  // Check we're not on main
  if (await isOnMainBranch()) {
    logger.error("Cannot create PR from main/master branch.");
    return;
  }

  // Check for existing PR
  const existingPr = await getPrForBranch();
  if (existingPr) {
    logger.warning(
      `A PR already exists for this branch: ${colors.url(existingPr.url)}`
    );
    return;
  }

  const currentBranch = await getCurrentBranch();
  const baseBranch = await getDefaultBranch();

  logger.info(`Branch: ${colors.branch(currentBranch)}`);
  logger.info(`Base: ${colors.branch(baseBranch)}`);

  // Auto-push if needed
  const hasUnpushed = await getUnpushedCommits();
  if (hasUnpushed) {
    await withSpinner("Pushing branch...", async () => {
      await pushBranch();
    });
    logger.success("Branch pushed");
  }

  // Extract issue number from branch
  const issueNumber = extractIssueNumber(currentBranch);
  let issue: GitHubIssue | null = null;

  if (issueNumber) {
    try {
      issue = await getIssue(issueNumber);
      logger.info(
        `Linked issue: ${colors.issue(`#${issueNumber}`)} - ${issue.title}`
      );
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

  // Check for UI changes and video capture capability
  // Video is enabled by default (config.video.enabled), but can be disabled with --no-video
  const shouldCaptureVideo = options.video !== false && config.video.enabled;
  let captureVideoInstructions = "";

  if (shouldCaptureVideo) {
    const changedFiles = await getChangedFiles(baseBranch);
    const uiChangesDetected = hasUIChanges(changedFiles);

    if (uiChangesDetected) {
      logger.info("UI changes detected in this branch");

      const playwrightAvailable = await isPlaywrightAvailable();
      if (!playwrightAvailable) {
        logger.warning("Playwright not available. Skipping video capture.");
        logger.dim("Install Playwright with: npm install -D playwright");
      } else {
        logger.info(
          "Playwright available - AI will capture demo video via MCP"
        );
        captureVideoInstructions = `

IMPORTANT: This PR contains UI changes. Use the Playwright MCP plugin to:
1. Start the dev server if needed
2. Navigate to the relevant pages showing the UI changes
3. Capture a short demo video (max ${config.video.max_duration}s) showcasing the changes
4. Upload the video to GitHub and include it in the PR description under a "## Demo Video" section
`;
      }
    }
  }

  // Generate PR description with AI
  const prompt =
    buildPrPrompt(issue, commits, diffSummary) + captureVideoInstructions;

  let prBody: string;
  try {
    logger.info(
      `Generating PR description with ${colors.provider(providerName)}...`
    );
    logger.newline();
    const result = await invokeAI(
      { prompt, streamOutput: true },
      config,
      options.provider
    );
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

    // Update issue labels to ai-completed
    const workflowLabels = getWorkflowLabels(config);
    try {
      await updateIssueLabels(issueNumber, {
        add: [workflowLabels.completed],
        remove: [workflowLabels.inProgress],
      });
      logger.success(
        `Updated labels: ${colors.label(workflowLabels.inProgress)} → ${colors.label(workflowLabels.completed)}`
      );
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

  // Suggest video creation if UI changes detected and Playwright available
  if (shouldCaptureVideo) {
    const changedFilesForHint =
      captureVideoInstructions !== ""
        ? [] // already checked above
        : await getChangedFiles(baseBranch);
    const uiChangesForHint =
      captureVideoInstructions !== ""
        ? true
        : hasUIChanges(changedFilesForHint);

    if (uiChangesForHint) {
      const playwrightOk = await isPlaywrightAvailable();
      if (playwrightOk) {
        logger.bold("Next Steps");
        logger.info(
          "Run `claude` with Playwright MCP to record a demo video of the changes."
        );
        logger.info(
          "Upload the result to GitHub Assets to keep the repo light."
        );
        logger.newline();
      }
    }
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
