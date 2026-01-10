import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock execa
vi.mock("execa", () => ({
  execa: vi.fn(),
}));

import { execa } from "execa";
import { getCurrentCommitSha, hasNewCommits } from "./git.js";

const mockExeca = vi.mocked(execa);

describe("git", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCurrentCommitSha", () => {
    it("should return the current commit SHA", async () => {
      mockExeca.mockResolvedValueOnce({
        stdout: "abc123def456",
        stderr: "",
        exitCode: 0,
      } as never);

      const sha = await getCurrentCommitSha();

      expect(sha).toBe("abc123def456");
      expect(mockExeca).toHaveBeenCalledWith("git", ["rev-parse", "HEAD"]);
    });

    it("should trim whitespace from SHA", async () => {
      mockExeca.mockResolvedValueOnce({
        stdout: "  abc123def456\n",
        stderr: "",
        exitCode: 0,
      } as never);

      const sha = await getCurrentCommitSha();

      expect(sha).toBe("abc123def456");
    });
  });

  describe("hasNewCommits", () => {
    it("should return true when current SHA differs from before SHA", async () => {
      mockExeca.mockResolvedValueOnce({
        stdout: "newsha789",
        stderr: "",
        exitCode: 0,
      } as never);

      const result = await hasNewCommits("oldsha123");

      expect(result).toBe(true);
    });

    it("should return false when current SHA matches before SHA", async () => {
      mockExeca.mockResolvedValueOnce({
        stdout: "samesha456",
        stderr: "",
        exitCode: 0,
      } as never);

      const result = await hasNewCommits("samesha456");

      expect(result).toBe(false);
    });
  });
});
