import { describe, expect, it } from "vitest";
import { extractReviewFeedbackItems, formatReviewFeedbackSummary, summarizeReviewFeedback, countActionableFeedback } from "./review-feedback.js";
import type { GitHubReviewData } from "../types/index.js";

const sampleData: GitHubReviewData = {
  reviews: [
    {
      author: "alice",
      body: "Please update the variable naming to match conventions.",
      state: "CHANGES_REQUESTED",
      submittedAt: "2026-01-14T12:00:00Z",
    },
    {
      author: "bob",
      body: "LGTM",
      state: "APPROVED",
      submittedAt: "2026-01-14T12:05:00Z",
    },
    {
      author: "carol",
      body: "Consider adding a unit test for the new helper.",
      state: "APPROVED",
      submittedAt: "2026-01-14T12:10:00Z",
    },
  ],
  reviewThreads: [
    {
      isResolved: false,
      path: "src/lib/foo.ts",
      line: 42,
      comments: [
        {
          author: "dave",
          body: "Fix this to handle the null case.",
          path: "src/lib/foo.ts",
          line: 42,
          createdAt: "2026-01-14T12:15:00Z",
        },
      ],
    },
  ],
  comments: [],
};

describe("extractReviewFeedbackItems", () => {
  it("filters actionable review feedback and threads", () => {
    const items = extractReviewFeedbackItems(sampleData);
    expect(items).toHaveLength(3);
    expect(items.some((item) => item.author === "alice" && item.source === "review")).toBe(true);
    expect(items.some((item) => item.author === "carol" && item.source === "review")).toBe(true);
    expect(items.some((item) => item.author === "dave" && item.source === "thread")).toBe(true);
  });

  it("ignores trivial comments", () => {
    const data: GitHubReviewData = {
      reviews: [
        { author: "bob", body: "LGTM", state: "APPROVED" },
      ],
      reviewThreads: [],
      comments: [],
    };
    const items = extractReviewFeedbackItems(data);
    expect(items).toHaveLength(0);
  });

  it("filters feedback by timestamp", () => {
    const items = extractReviewFeedbackItems(sampleData, { afterTimestamp: "2026-01-14T12:08:00Z" });
    // Should only include carol's review (12:10) and dave's thread (unresolved, always included)
    expect(items).toHaveLength(2);
    expect(items.some((item) => item.author === "carol")).toBe(true);
    expect(items.some((item) => item.author === "dave")).toBe(true);
    expect(items.some((item) => item.author === "alice")).toBe(false);
  });

  it("skips unresolved threads before timestamp", () => {
    const data: GitHubReviewData = {
      reviews: [],
      reviewThreads: [
        {
          isResolved: false,
          path: "src/old.ts",
          line: 10,
          comments: [
            { author: "old", body: "Fix this bug", createdAt: "2026-01-01T00:00:00Z" },
          ],
        },
      ],
      comments: [],
    };
    const items = extractReviewFeedbackItems(data, { afterTimestamp: "2026-01-14T00:00:00Z" });
    expect(items).toHaveLength(0);
  });

  it("skips outdated threads even if unresolved", () => {
    const data: GitHubReviewData = {
      reviews: [],
      reviewThreads: [
        {
          isResolved: false,
          isOutdated: true,
          path: "src/old.ts",
          line: 10,
          comments: [
            { author: "dave", body: "Change this", createdAt: "2026-01-14T15:00:00Z" },
          ],
        },
      ],
      comments: [],
    };
    const items = extractReviewFeedbackItems(data);
    expect(items).toHaveLength(0);
  });

  it("includes actionable PR comments", () => {
    const data: GitHubReviewData = {
      reviews: [],
      reviewThreads: [],
      comments: [
        { author: "eve", body: "Please add error handling here", createdAt: "2026-01-14T13:00:00Z" },
        { author: "frank", body: "Nice work!", createdAt: "2026-01-14T13:05:00Z" },
      ],
    };
    const items = extractReviewFeedbackItems(data);
    expect(items).toHaveLength(1);
    expect(items[0].author).toBe("eve");
    expect(items[0].source).toBe("comment");
  });

  it("filters PR comments by timestamp", () => {
    const data: GitHubReviewData = {
      reviews: [],
      reviewThreads: [],
      comments: [
        { author: "eve", body: "Please fix this", createdAt: "2026-01-14T10:00:00Z" },
        { author: "frank", body: "Also update that", createdAt: "2026-01-14T15:00:00Z" },
      ],
    };
    const items = extractReviewFeedbackItems(data, { afterTimestamp: "2026-01-14T12:00:00Z" });
    expect(items).toHaveLength(1);
    expect(items[0].author).toBe("frank");
  });
});

describe("formatReviewFeedbackSummary", () => {
  it("formats feedback summary lines", () => {
    const items = extractReviewFeedbackItems(sampleData);
    const summary = formatReviewFeedbackSummary(items);
    expect(summary).toContain("Review (changes requested)");
    expect(summary).toContain("src/lib/foo.ts:42");
    expect(summary).toContain("@alice");
  });

  it("formats PR comment summary lines", () => {
    const items = [{ source: "comment" as const, author: "eve", body: "Please add tests" }];
    const summary = formatReviewFeedbackSummary(items);
    expect(summary).toContain("[Comment]");
    expect(summary).toContain("@eve");
  });
});

describe("summarizeReviewFeedback", () => {
  it("returns empty summary when no actionable feedback", () => {
    const result = summarizeReviewFeedback({ reviews: [], reviewThreads: [], comments: [] });
    expect(result.items).toHaveLength(0);
    expect(result.summary).toBe("");
  });
});

describe("countActionableFeedback", () => {
  it("counts all actionable feedback items", () => {
    const counts = countActionableFeedback(sampleData);
    expect(counts.total).toBe(3);
  });

  it("counts unresolved threads", () => {
    const counts = countActionableFeedback(sampleData);
    expect(counts.unresolvedThreads).toBe(1);
  });

  it("counts changes requested reviews", () => {
    const counts = countActionableFeedback(sampleData);
    expect(counts.changesRequested).toBe(1);
  });

  it("returns zero counts for empty data", () => {
    const counts = countActionableFeedback({ reviews: [], reviewThreads: [], comments: [] });
    expect(counts.total).toBe(0);
    expect(counts.unresolvedThreads).toBe(0);
    expect(counts.changesRequested).toBe(0);
  });

  it("respects timestamp filtering", () => {
    const counts = countActionableFeedback(sampleData, { afterTimestamp: "2026-01-14T12:08:00Z" });
    // Should only count carol's review (approved with actionable text) and dave's thread
    expect(counts.total).toBe(2);
    expect(counts.changesRequested).toBe(0); // alice's review is before timestamp
  });

  it("counts multiple unresolved threads", () => {
    const data: GitHubReviewData = {
      reviews: [],
      reviewThreads: [
        {
          isResolved: false,
          path: "src/a.ts",
          line: 10,
          comments: [{ author: "a", body: "Fix this", createdAt: "2026-01-14T12:00:00Z" }],
        },
        {
          isResolved: false,
          path: "src/b.ts",
          line: 20,
          comments: [{ author: "b", body: "Update this", createdAt: "2026-01-14T12:00:00Z" }],
        },
      ],
      comments: [],
    };
    const counts = countActionableFeedback(data);
    expect(counts.total).toBe(2);
    expect(counts.unresolvedThreads).toBe(2);
  });
});
