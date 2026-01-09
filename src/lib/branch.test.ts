import { describe, it, expect } from "vitest";
import { parseBranchName, extractIssueNumber } from "./branch.js";

describe("branch", () => {
  describe("parseBranchName", () => {
    it("should parse author/type-issue-slug pattern", () => {
      const result = parseBranchName("ro/feature-123-add-user-auth");

      expect(result).toEqual({
        name: "ro/feature-123-add-user-auth",
        author: "ro",
        type: "feature",
        issueNumber: 123,
        slug: "add-user-auth",
      });
    });

    it("should parse type/issue-slug pattern", () => {
      const result = parseBranchName("fix/456-button-alignment");

      expect(result).toEqual({
        name: "fix/456-button-alignment",
        author: "",
        type: "fix",
        issueNumber: 456,
        slug: "button-alignment",
      });
    });

    it("should parse issue-slug pattern", () => {
      const result = parseBranchName("789-api-refactor");

      expect(result).toEqual({
        name: "789-api-refactor",
        author: "",
        type: "feature",
        issueNumber: 789,
        slug: "api-refactor",
      });
    });

    it("should extract issue number from any branch with number", () => {
      const result = parseBranchName("some-random-branch-123");

      expect(result?.issueNumber).toBe(123);
    });

    it("should return null for branches without issue number", () => {
      const result = parseBranchName("main");

      expect(result).toBeNull();
    });
  });

  describe("extractIssueNumber", () => {
    it("should extract issue number from standard branch", () => {
      expect(extractIssueNumber("ro/feature-123-add-login")).toBe(123);
    });

    it("should extract issue number from simple branch", () => {
      expect(extractIssueNumber("456-fix-bug")).toBe(456);
    });

    it("should return null for branches without numbers", () => {
      expect(extractIssueNumber("main")).toBeNull();
    });
  });
});
