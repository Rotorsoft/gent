import { loadConfig, configExists } from "../lib/config.js";
import {
  getIssue,
  getPrStatus,
  getPrReviewData,
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
    };
  }

  const config = loadConfig();
  const workflowLabels = getWorkflowLabels(config);

  // Gather prerequisites and git state in parallel
  const [
    isGhAuthenticated,
    isAIProviderAvailable,
    branch,
    isOnMain,
    uncommitted,
    baseBranch,
  ] = await Promise.all([
    checkGhAuth(),
    checkAIProvider(config.ai.provider),
    getCurrentBranch(),
    isOnMainBranch(),
    hasUncommittedChanges(),
    getDefaultBranch(),
  ]);

  const hasConfig = configExists();
  const hasProgress = progressExists(config);
  const branchInfo = parseBranchName(branch);

  // Get commits and unpushed status
  const [commits, unpushed] = await Promise.all([
    getCommitsSinceBase(baseBranch),
    getUnpushedCommits(),
  ]);

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
    const [issueResult, prResult, changedFiles, playwrightResult] =
      await Promise.all([
        issueNumber
          ? getIssue(issueNumber).catch(() => null)
          : Promise.resolve(null),
        getPrStatus().catch(() => null),
        getChangedFiles(baseBranch),
        isPlaywrightAvailable(),
      ]);

    issue = issueResult;
    pr = prResult;
    uiChanges = hasUIChanges(changedFiles);
    playwrightAvailable = playwrightResult;

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
  };
}
