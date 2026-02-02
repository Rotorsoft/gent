import { loadConfig, configExists } from "../lib/config.js";
import {
  getIssue,
  getPrStatus,
  getPrReviewData,
  checkLabelsExist,
  type PrStatusInfo,
} from "../lib/github.js";
import {
  getCurrentBranch,
  isOnMainBranch,
  hasUncommittedChanges,
  getUnpushedCommits,
  getCommitsSinceBase,
  getDefaultBranch,
  getLastCommitTimestamp,
  getRepoInfo,
} from "../lib/git.js";
import { extractIssueNumber, parseBranchName } from "../lib/branch.js";
import { getWorkflowLabels } from "../lib/labels.js";
import { progressExists } from "../lib/progress.js";
import {
  checkGhAuth,
  checkAIProvider,
  checkGitRepo,
} from "../utils/validators.js";
import {
  summarizeReviewFeedback,
  type ReviewFeedbackItem,
} from "../lib/review-feedback.js";
import {
  hasUIChanges,
  getChangedFiles,
  isPlaywrightAvailable,
} from "../lib/playwright.js";
import type { GentConfig, GitHubIssue, BranchInfo } from "../types/index.js";

export type WorkflowStatus =
  | "ready"
  | "in-progress"
  | "completed"
  | "blocked"
  | "none";

export interface TuiState {
  // Prerequisites
  isGitRepo: boolean;
  isGhAuthenticated: boolean;
  isAIProviderAvailable: boolean;

  // Configuration
  config: GentConfig;
  hasConfig: boolean;
  hasProgress: boolean;

  // Git state
  branch: string;
  branchInfo: BranchInfo | null;
  isOnMain: boolean;
  hasUncommittedChanges: boolean;
  hasUnpushedCommits: boolean;
  commits: string[];
  baseBranch: string;

  // Issue state
  issue: GitHubIssue | null;
  workflowStatus: WorkflowStatus;

  // PR state
  pr: PrStatusInfo | null;
  reviewFeedback: ReviewFeedbackItem[];
  hasActionableFeedback: boolean;

  // UI changes detection
  hasUIChanges: boolean;
  isPlaywrightAvailable: boolean;

  // Remote detection
  hasValidRemote: boolean;

  // Setup state
  hasLabels: boolean;
}

// Session-level cache for environment checks that don't change mid-session
let envCache: {
  isGhAuthenticated: boolean;
  isAIProviderAvailable: boolean;
  isPlaywrightAvailable: boolean;
  hasLabels: boolean | null; // null = not yet checked
} | null = null;

/** Reset the environment cache (for testing). */
export function resetEnvCache(): void {
  envCache = null;
}

export async function aggregateState(): Promise<TuiState> {
  // Check prerequisites first
  const isGitRepo = await checkGitRepo();
  if (!isGitRepo) {
    // Return minimal state for non-git directories
    const config = loadConfig();
    return {
      isGitRepo: false,
      isGhAuthenticated: false,
      isAIProviderAvailable: false,
      config,
      hasConfig: false,
      hasProgress: false,
      branch: "",
      branchInfo: null,
      isOnMain: false,
      hasUncommittedChanges: false,
      hasUnpushedCommits: false,
      commits: [],
      baseBranch: "main",
      issue: null,
      workflowStatus: "none",
      pr: null,
      reviewFeedback: [],
      hasActionableFeedback: false,
      hasUIChanges: false,
      isPlaywrightAvailable: false,
      hasValidRemote: false,
      hasLabels: false,
    };
  }

  const config = loadConfig();
  const workflowLabels = getWorkflowLabels(config);

  // Check environment once per session (these don't change mid-session)
  if (!envCache) {
    const [ghAuth, aiAvail] = await Promise.all([
      checkGhAuth(),
      checkAIProvider(config.ai.provider),
    ]);
    envCache = {
      isGhAuthenticated: ghAuth,
      isAIProviderAvailable: aiAvail,
      isPlaywrightAvailable: false, // resolved below on first feature branch visit
      hasLabels: null, // resolved below when config and remote exist
    };
  }
  const { isGhAuthenticated, isAIProviderAvailable } = envCache;

  // Gather git state in parallel
  const [branch, isOnMain, uncommitted, baseBranch, repoInfo] =
    await Promise.all([
      getCurrentBranch(),
      isOnMainBranch(),
      hasUncommittedChanges(),
      getDefaultBranch(),
      getRepoInfo(),
    ]);

  const hasConfig = configExists();
  const hasProgress = progressExists(config);
  const branchInfo = parseBranchName(branch);

  // Get commits and unpushed status
  const [commits, unpushed] = await Promise.all([
    getCommitsSinceBase(baseBranch),
    getUnpushedCommits(),
  ]);

  // Check labels once per session (deferred until remote exists)
  const hasRemote = repoInfo !== null;
  if (hasRemote && envCache!.hasLabels === null) {
    envCache!.hasLabels = await checkLabelsExist().catch(() => false);
  }
  const hasLabels = envCache!.hasLabels ?? false;

  // Initialize state
  let issue: GitHubIssue | null = null;
  let workflowStatus: WorkflowStatus = "none";
  let pr: PrStatusInfo | null = null;
  let reviewFeedback: ReviewFeedbackItem[] = [];
  let hasActionableFeedback = false;
  let uiChanges = false;
  let playwrightAvailable = false;

  // If not on main, fetch issue and PR data
  if (!isOnMain) {
    const issueNumber = extractIssueNumber(branch);

    // Fetch issue, PR status, and UI change detection in parallel
    // Playwright availability is cached per session
    const needsPlaywrightCheck = !envCache!.isPlaywrightAvailable;
    const [issueResult, prResult, changedFiles, playwrightResult] =
      await Promise.all([
        issueNumber
          ? getIssue(issueNumber).catch(() => null)
          : Promise.resolve(null),
        getPrStatus().catch(() => null),
        getChangedFiles(baseBranch),
        needsPlaywrightCheck
          ? isPlaywrightAvailable()
          : Promise.resolve(envCache!.isPlaywrightAvailable),
      ]);

    issue = issueResult;
    pr = prResult;
    uiChanges = hasUIChanges(changedFiles);
    playwrightAvailable = playwrightResult;
    if (needsPlaywrightCheck) {
      envCache!.isPlaywrightAvailable = playwrightResult;
    }

    // Determine workflow status from labels
    if (issue) {
      if (issue.labels.includes(workflowLabels.ready)) {
        workflowStatus = "ready";
      } else if (issue.labels.includes(workflowLabels.inProgress)) {
        workflowStatus = "in-progress";
      } else if (issue.labels.includes(workflowLabels.completed)) {
        workflowStatus = "completed";
      } else if (issue.labels.includes(workflowLabels.blocked)) {
        workflowStatus = "blocked";
      }
    }

    // Fetch review feedback if PR exists and is open
    if (pr && pr.state === "open") {
      try {
        const lastCommitTimestamp = await getLastCommitTimestamp();
        const reviewData = await getPrReviewData(pr.number);
        const { items } = summarizeReviewFeedback(reviewData, {
          afterTimestamp: lastCommitTimestamp,
        });
        reviewFeedback = items;
        hasActionableFeedback = items.length > 0;
      } catch {
        // Ignore review data fetch errors
      }
    }
  }

  return {
    isGitRepo,
    isGhAuthenticated,
    isAIProviderAvailable,
    config,
    hasConfig,
    hasProgress,
    branch,
    branchInfo,
    isOnMain,
    hasUncommittedChanges: uncommitted,
    hasUnpushedCommits: unpushed,
    commits,
    baseBranch,
    issue,
    workflowStatus,
    pr,
    reviewFeedback,
    hasActionableFeedback,
    hasUIChanges: uiChanges,
    isPlaywrightAvailable: playwrightAvailable,
    hasValidRemote: hasRemote,
    hasLabels,
  };
}
