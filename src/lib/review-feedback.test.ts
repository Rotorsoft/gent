import { describe, expect, it } from "vitest";
import { extractReviewFeedbackItems, formatReviewFeedbackSummary, summarizeReviewFeedback } from "./review-feedback.js";
import type { GitHubReviewData } from "../types/index.js";

const sampleData: GitHubReviewData = {
  reviews: [
    {
      author: "alice",
      body: "Please update the variable naming to match conventions.",
      state: "CHANGES_REQUESTED",
    },
    {
      author: "bob",
      body: "LGTM",
      state: "APPROVED",
    },
    {
      author: "carol",
      body: "Consider adding a unit test for the new helper.",
      state: "APPROVED",
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
        },
      ],
    },
  ],
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
    };
    const items = extractReviewFeedbackItems(data);
    expect(items).toHaveLength(0);
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
});

describe("summarizeReviewFeedback", () => {
  it("returns empty summary when no actionable feedback", () => {
    const result = summarizeReviewFeedback({ reviews: [], reviewThreads: [] });
    expect(result.items).toHaveLength(0);
    expect(result.summary).toBe("");
  });
});
