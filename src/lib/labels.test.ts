import { describe, it, expect } from "vitest";
import {
  buildIssueLabels,
  extractTypeFromLabels,
  extractPriorityFromLabels,
  sortByPriority,
} from "./labels.js";

describe("labels", () => {
  describe("buildIssueLabels", () => {
    it("should build labels from metadata", () => {
      const labels = buildIssueLabels({
        type: "feature",
        priority: "high",
        risk: "low",
        area: "ui",
      });

      expect(labels).toContain("ai-ready");
      expect(labels).toContain("type:feature");
      expect(labels).toContain("priority:high");
      expect(labels).toContain("risk:low");
      expect(labels).toContain("area:ui");
    });
  });

  describe("extractTypeFromLabels", () => {
    it("should extract type from labels", () => {
      const labels = ["ai-ready", "type:fix", "priority:high"];
      expect(extractTypeFromLabels(labels)).toBe("fix");
    });

    it("should return feature as default", () => {
      const labels = ["ai-ready", "priority:high"];
      expect(extractTypeFromLabels(labels)).toBe("feature");
    });
  });

  describe("extractPriorityFromLabels", () => {
    it("should extract priority from labels", () => {
      const labels = ["ai-ready", "type:fix", "priority:critical"];
      expect(extractPriorityFromLabels(labels)).toBe("critical");
    });

    it("should return medium as default", () => {
      const labels = ["ai-ready", "type:fix"];
      expect(extractPriorityFromLabels(labels)).toBe("medium");
    });
  });

  describe("sortByPriority", () => {
    it("should sort issues by priority", () => {
      const issues = [
        { labels: ["priority:low"] },
        { labels: ["priority:critical"] },
        { labels: ["priority:medium"] },
        { labels: ["priority:high"] },
      ];

      sortByPriority(issues);

      expect(extractPriorityFromLabels(issues[0].labels)).toBe("critical");
      expect(extractPriorityFromLabels(issues[1].labels)).toBe("high");
      expect(extractPriorityFromLabels(issues[2].labels)).toBe("medium");
      expect(extractPriorityFromLabels(issues[3].labels)).toBe("low");
    });
  });
});
