import { describe, it, expect } from "vitest";
import { findBranchForIssue, buildTicketChoices } from "./list.js";
import type { GitHubIssue } from "../types/index.js";
import type { OpenPr } from "../lib/github.js";

describe("findBranchForIssue", () => {
  it("finds branch matching issue number with author/type-issue-slug pattern", () => {
    const branches = ["main", "ro/feature-42-add-login", "ro/fix-99-typo"];
    expect(findBranchForIssue(42, branches)).toBe("ro/feature-42-add-login");
  });

  it("finds branch matching issue number with type/issue-slug pattern", () => {
    const branches = ["main", "feature/42-add-login"];
    expect(findBranchForIssue(42, branches)).toBe("feature/42-add-login");
  });

  it("finds branch matching issue number with issue-slug pattern", () => {
    const branches = ["main", "42-add-login"];
    expect(findBranchForIssue(42, branches)).toBe("42-add-login");
  });

  it("returns null when no branch matches", () => {
    const branches = ["main", "ro/feature-99-other"];
    expect(findBranchForIssue(42, branches)).toBeNull();
  });

  it("returns null for empty branches list", () => {
    expect(findBranchForIssue(42, [])).toBeNull();
  });

  it("returns first matching branch when multiple match", () => {
    const branches = ["ro/feature-42-first", "ro/fix-42-second"];
    expect(findBranchForIssue(42, branches)).toBe("ro/feature-42-first");
  });
});

describe("buildTicketChoices", () => {
  const makeIssue = (number: number, title: string, labels: string[] = []): GitHubIssue => ({
    number,
    title,
    body: "",
    labels,
    state: "open",
    url: `https://github.com/test/repo/issues/${number}`,
  });

  const makePr = (number: number, title: string, branch: string): OpenPr => ({
    number,
    title,
    headRefName: branch,
    url: `https://github.com/test/repo/pull/${number}`,
  });

  it("categorizes in-progress issues", () => {
    const inProgress = [makeIssue(1, "Task A", ["ai-in-progress"])];
    const choices = buildTicketChoices(inProgress, [], [], ["ro/feature-1-task-a"]);

    expect(choices).toHaveLength(1);
    expect(choices[0].category).toBe("in-progress");
    expect(choices[0].issueNumber).toBe(1);
    expect(choices[0].branch).toBe("ro/feature-1-task-a");
  });

  it("categorizes in-progress issues with open PR as open-pr", () => {
    const inProgress = [makeIssue(1, "Task A", ["ai-in-progress"])];
    const prs = [makePr(10, "PR for task A", "ro/feature-1-task-a")];
    const choices = buildTicketChoices(inProgress, [], prs, ["ro/feature-1-task-a"]);

    expect(choices).toHaveLength(1);
    expect(choices[0].category).toBe("open-pr");
  });

  it("categorizes ready issues", () => {
    const ready = [makeIssue(2, "Task B", ["ai-ready"])];
    const choices = buildTicketChoices([], ready, [], []);

    expect(choices).toHaveLength(1);
    expect(choices[0].category).toBe("ready");
    expect(choices[0].branch).toBeNull();
  });

  it("adds PRs for issues not in other lists", () => {
    const prs = [makePr(10, "PR for task C", "ro/feature-3-task-c")];
    const choices = buildTicketChoices([], [], prs, []);

    expect(choices).toHaveLength(1);
    expect(choices[0].category).toBe("open-pr");
    expect(choices[0].issueNumber).toBe(3);
    expect(choices[0].branch).toBe("ro/feature-3-task-c");
  });

  it("deduplicates issues across categories", () => {
    const inProgress = [makeIssue(1, "Task A")];
    const ready = [makeIssue(1, "Task A")];
    const choices = buildTicketChoices(inProgress, ready, [], []);

    expect(choices).toHaveLength(1);
  });

  it("returns empty array when no tickets found", () => {
    const choices = buildTicketChoices([], [], [], []);
    expect(choices).toHaveLength(0);
  });

  it("orders in-progress before open-pr before ready", () => {
    const inProgress = [makeIssue(1, "In progress task")];
    const ready = [makeIssue(3, "Ready task")];
    const prs = [makePr(10, "PR task", "ro/feature-2-pr-task")];
    const choices = buildTicketChoices(inProgress, ready, prs, []);

    expect(choices[0].category).toBe("in-progress");
    expect(choices[1].category).toBe("open-pr");
    expect(choices[2].category).toBe("ready");
  });

  it("uses PR branch when no local branch found for in-progress issue", () => {
    const inProgress = [makeIssue(5, "Task E")];
    const prs = [makePr(20, "PR for E", "ro/feature-5-task-e")];
    const choices = buildTicketChoices(inProgress, [], prs, []);

    expect(choices).toHaveLength(1);
    expect(choices[0].branch).toBe("ro/feature-5-task-e");
  });
});
