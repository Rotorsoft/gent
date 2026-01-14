import type { GitHubReviewData } from "../types/index.js";

export interface ReviewFeedbackItem {
  source: "review" | "thread" | "comment";
  author: string;
  body: string;
  state?: string;
  path?: string;
  line?: number | null;
  commentId?: number | string;
}

export interface ReviewFeedbackOptions {
  afterTimestamp?: string;
}

const ACTIONABLE_KEYWORDS = [
  "todo",
  "fix",
  "should",
  "must",
  "needs",
  "please",
  "consider",
  "can you",
  "change",
  "update",
  "remove",
  "add",
];

const TRIVIAL_COMMENTS = ["lgtm", "looks good", "approved"];

export function summarizeReviewFeedback(data: GitHubReviewData, options?: ReviewFeedbackOptions): {
  items: ReviewFeedbackItem[];
  summary: string;
} {
  const items = extractReviewFeedbackItems(data, options);
  return {
    items,
    summary: items.length > 0 ? formatReviewFeedbackSummary(items) : "",
  };
}

function isAfterTimestamp(itemTimestamp: string | undefined, afterTimestamp: string | undefined): boolean {
  if (!afterTimestamp || !itemTimestamp) {
    return true;
  }
  return new Date(itemTimestamp) > new Date(afterTimestamp);
}

export function extractReviewFeedbackItems(data: GitHubReviewData, options?: ReviewFeedbackOptions): ReviewFeedbackItem[] {
  const items: ReviewFeedbackItem[] = [];
  const afterTimestamp = options?.afterTimestamp;

  for (const review of data.reviews) {
    const body = review.body?.trim() ?? "";
    if (!body || isTrivialComment(body)) {
      continue;
    }

    // Filter by timestamp if provided
    if (!isAfterTimestamp(review.submittedAt, afterTimestamp)) {
      continue;
    }

    const isChangesRequested = review.state === "CHANGES_REQUESTED";
    const actionable = isChangesRequested || isActionableText(body);
    if (!actionable) {
      continue;
    }

    items.push({
      source: "review",
      author: review.author,
      body,
      state: review.state,
    });
  }

  for (const thread of data.reviewThreads) {
    // Always include unresolved threads regardless of timestamp
    const isUnresolved = thread.isResolved === false || thread.isResolved === undefined || thread.isResolved === null;

    // For resolved threads, check if there are recent comments
    if (!isUnresolved) {
      const hasRecentComments = (thread.comments ?? []).some(
        (c) => isAfterTimestamp(c.createdAt, afterTimestamp)
      );
      if (!hasRecentComments) {
        continue;
      }
    }

    if (!isActionableThread(thread)) {
      continue;
    }

    const comments = thread.comments ?? [];
    const latestComment = findLatestMeaningfulComment(comments);
    if (!latestComment) {
      continue;
    }

    items.push({
      source: "thread",
      author: latestComment.author,
      body: latestComment.body,
      path: thread.path ?? latestComment.path,
      line: thread.line ?? latestComment.line ?? null,
      commentId: latestComment.id,
    });
  }

  // Process PR comments
  for (const comment of data.comments ?? []) {
    const body = comment.body?.trim() ?? "";
    if (!body || isTrivialComment(body)) {
      continue;
    }

    // Filter by timestamp if provided
    if (!isAfterTimestamp(comment.createdAt, afterTimestamp)) {
      continue;
    }

    // Only include actionable comments
    if (!isActionableText(body)) {
      continue;
    }

    items.push({
      source: "comment",
      author: comment.author,
      body,
      commentId: comment.id,
    });
  }

  return items;
}

export function formatReviewFeedbackSummary(items: ReviewFeedbackItem[]): string {
  return items
    .map((item) => {
      const location = formatLocation(item);
      const stateLabel = item.state ? formatState(item.state) : null;
      const author = item.author ? `@${item.author}` : "Reviewer";
      const body = truncateComment(item.body);
      let header: string;
      if (item.source === "review") {
        header = stateLabel ? `Review (${stateLabel})` : "Review";
      } else if (item.source === "comment") {
        header = "Comment";
      } else {
        header = location;
      }
      return `- [${header}] ${author}: ${body}`;
    })
    .join("\n");
}

function isActionableThread(thread: { isResolved?: boolean | null; comments?: { body: string }[] }): boolean {
  if (thread.isResolved === false || thread.isResolved === undefined || thread.isResolved === null) {
    return true;
  }
  return (thread.comments ?? []).some((comment) => isActionableText(comment.body));
}

function isActionableText(text: string): boolean {
  const normalized = text.toLowerCase();
  return ACTIONABLE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function isTrivialComment(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return TRIVIAL_COMMENTS.some((entry) => normalized === entry);
}

function findLatestMeaningfulComment<T extends { body: string; id?: number | string }>(comments: T[]): T | null {
  for (let i = comments.length - 1; i >= 0; i -= 1) {
    const body = comments[i].body?.trim() ?? "";
    if (body && !isTrivialComment(body)) {
      return comments[i];
    }
  }
  return null;
}

function formatLocation(item: { path?: string; line?: number | null }): string {
  if (item.path && item.line) {
    return `${item.path}:${item.line}`;
  }
  if (item.path) {
    return item.path;
  }
  return "Thread";
}

function formatState(state: string): string {
  return state.replace(/_/g, " ").toLowerCase();
}

function truncateComment(body: string, maxLength = 200): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3)}...`;
}
