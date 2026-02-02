import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock execa
vi.mock("execa", () => ({
  execa: vi.fn(),
}));

// Mock config
vi.mock("./config.js", () => ({
  configExists: vi.fn(),
}));

// Mock github
vi.mock("./github.js", () => ({
  checkLabelsExist: vi.fn(),
}));

import { execa } from "execa";
import { configExists } from "./config.js";
import { checkLabelsExist } from "./github.js";
import { getCurrentCommitSha, hasNewCommits, getRepoSetupState } from "./git.js";

const mockConfigExists = vi.mocked(configExists);
const mockCheckLabelsExist = vi.mocked(checkLabelsExist);

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

  describe("getRepoSetupState", () => {
    it("should return all false when git is not initialized", async () => {
      mockExeca.mockRejectedValueOnce(new Error("not a git repo"));

      const state = await getRepoSetupState();

      expect(state).toEqual({
        gitInitialized: false,
        gentInitialized: false,
        hasRemote: false,
        hasLabels: false,
      });
    });

    it("should detect git init but no gent config and still check remote", async () => {
      // git rev-parse --git-dir
      mockExeca.mockResolvedValueOnce({ stdout: ".git", stderr: "", exitCode: 0 } as never);
      mockConfigExists.mockReturnValue(false);
      // git config --get remote.origin.url
      mockExeca.mockRejectedValueOnce(new Error("no remote"));

      const state = await getRepoSetupState();

      expect(state).toEqual({
        gitInitialized: true,
        gentInitialized: false,
        hasRemote: false,
        hasLabels: false,
      });
    });

    it("should detect git init without config but with remote and labels", async () => {
      // git rev-parse --git-dir
      mockExeca.mockResolvedValueOnce({ stdout: ".git", stderr: "", exitCode: 0 } as never);
      mockConfigExists.mockReturnValue(false);
      // git config --get remote.origin.url
      mockExeca.mockResolvedValueOnce({ stdout: "git@github.com:owner/repo.git", stderr: "", exitCode: 0 } as never);
      mockCheckLabelsExist.mockResolvedValue(true);

      const state = await getRepoSetupState();

      expect(state).toEqual({
        gitInitialized: true,
        gentInitialized: false,
        hasRemote: true,
        hasLabels: true,
      });
    });

    it("should detect git + gent but no remote", async () => {
      // git rev-parse --git-dir
      mockExeca.mockResolvedValueOnce({ stdout: ".git", stderr: "", exitCode: 0 } as never);
      mockConfigExists.mockReturnValue(true);
      // git config --get remote.origin.url
      mockExeca.mockRejectedValueOnce(new Error("no remote"));

      const state = await getRepoSetupState();

      expect(state).toEqual({
        gitInitialized: true,
        gentInitialized: true,
        hasRemote: false,
        hasLabels: false,
      });
    });

    it("should detect git + gent + remote but no labels", async () => {
      // git rev-parse --git-dir
      mockExeca.mockResolvedValueOnce({ stdout: ".git", stderr: "", exitCode: 0 } as never);
      mockConfigExists.mockReturnValue(true);
      // git config --get remote.origin.url
      mockExeca.mockResolvedValueOnce({ stdout: "git@github.com:owner/repo.git", stderr: "", exitCode: 0 } as never);
      mockCheckLabelsExist.mockResolvedValue(false);

      const state = await getRepoSetupState();

      expect(state).toEqual({
        gitInitialized: true,
        gentInitialized: true,
        hasRemote: true,
        hasLabels: false,
      });
    });

    it("should detect fully set up repo", async () => {
      // git rev-parse --git-dir
      mockExeca.mockResolvedValueOnce({ stdout: ".git", stderr: "", exitCode: 0 } as never);
      mockConfigExists.mockReturnValue(true);
      // git config --get remote.origin.url
      mockExeca.mockResolvedValueOnce({ stdout: "https://github.com/owner/repo.git", stderr: "", exitCode: 0 } as never);
      mockCheckLabelsExist.mockResolvedValue(true);

      const state = await getRepoSetupState();

      expect(state).toEqual({
        gitInitialized: true,
        gentInitialized: true,
        hasRemote: true,
        hasLabels: true,
      });
    });

    it("should handle checkLabelsExist failure gracefully", async () => {
      // git rev-parse --git-dir
      mockExeca.mockResolvedValueOnce({ stdout: ".git", stderr: "", exitCode: 0 } as never);
      mockConfigExists.mockReturnValue(true);
      // git config --get remote.origin.url
      mockExeca.mockResolvedValueOnce({ stdout: "git@github.com:owner/repo.git", stderr: "", exitCode: 0 } as never);
      mockCheckLabelsExist.mockRejectedValue(new Error("network error"));

      const state = await getRepoSetupState();

      expect(state).toEqual({
        gitInitialized: true,
        gentInitialized: true,
        hasRemote: true,
        hasLabels: false,
      });
    });
  });
});
