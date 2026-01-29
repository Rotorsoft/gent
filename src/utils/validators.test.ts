import { describe, it, expect, vi } from "vitest";
import { execa } from "execa";
import {
  isValidIssueNumber,
  sanitizeSlug,
  checkCodexCLI,
  checkAIProvider,
} from "./validators.js";

vi.mock("execa");

describe("validators", () => {
  describe("isValidIssueNumber", () => {
    it("should return true for valid issue numbers", () => {
      expect(isValidIssueNumber("1")).toBe(true);
      expect(isValidIssueNumber("123")).toBe(true);
      expect(isValidIssueNumber("99999")).toBe(true);
    });

    it("should return false for invalid issue numbers", () => {
      expect(isValidIssueNumber("0")).toBe(false);
      expect(isValidIssueNumber("-1")).toBe(false);
      expect(isValidIssueNumber("abc")).toBe(false);
      expect(isValidIssueNumber("")).toBe(false);
    });
  });

  describe("sanitizeSlug", () => {
    it("should convert to lowercase", () => {
      expect(sanitizeSlug("ADD USER AUTH")).toBe("add-user-auth");
    });

    it("should replace special characters with hyphens", () => {
      expect(sanitizeSlug("Add user's auth!")).toBe("add-user-s-auth");
    });

    it("should trim leading and trailing hyphens", () => {
      expect(sanitizeSlug("--add-auth--")).toBe("add-auth");
    });

    it("should limit length", () => {
      const longTitle =
        "this-is-a-very-long-title-that-should-be-truncated-at-some-point";
      expect(sanitizeSlug(longTitle, 20).length).toBeLessThanOrEqual(20);
    });

    it("should handle empty strings", () => {
      expect(sanitizeSlug("")).toBe("");
    });
  });

  describe("checkCodexCLI", () => {
    it("should return true if codex CLI is installed", async () => {
      vi.mocked(execa).mockResolvedValue({} as any);
      const result = await checkCodexCLI();
      expect(result).toBe(true);
      expect(execa).toHaveBeenCalledWith("codex", ["--version"]);
    });

    it("should return false if codex CLI is not installed", async () => {
      vi.mocked(execa).mockRejectedValue(new Error("Command not found"));
      const result = await checkCodexCLI();
      expect(result).toBe(false);
    });
  });

  describe("checkAIProvider", () => {
    it("should check for codex when specified", async () => {
      vi.mocked(execa).mockResolvedValue({} as any);
      await checkAIProvider("codex");
      expect(execa).toHaveBeenCalledWith("codex", ["--version"]);
    });

    it("should check for claude when specified", async () => {
      vi.mocked(execa).mockResolvedValue({} as any);
      await checkAIProvider("claude");
      expect(execa).toHaveBeenCalledWith("claude", ["--version"]);
    });

    it("should check for gemini when specified", async () => {
      vi.mocked(execa).mockResolvedValue({} as any);
      await checkAIProvider("gemini");
      expect(execa).toHaveBeenCalledWith("gemini", ["--version"]);
    });
  });
});
