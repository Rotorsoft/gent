import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock execa
vi.mock("execa", () => ({
  execa: vi.fn(),
}));

import { execa } from "execa";
import {
  getProviderDisplayName,
  invokeAI,
  invokeAIInteractive,
  isTimeoutError,
  AI_DEFAULT_TIMEOUT_MS,
} from "./ai-provider.js";
import type { AIProvider, GentConfig } from "../types/index.js";

const mockExeca = vi.mocked(execa);

// Minimal config for testing
const createTestConfig = (
  provider: AIProvider,
  fallback?: AIProvider
): GentConfig => ({
  version: 1,
  github: {
    labels: {
      workflow: {
        ready: "ai-ready",
        in_progress: "ai-in-progress",
        completed: "ai-completed",
        blocked: "ai-blocked",
      },
      types: ["feature", "fix"],
      priorities: ["high", "medium", "low"],
      risks: ["high", "medium", "low"],
      areas: ["api", "ui"],
    },
  },
  branch: {
    pattern: "{author}/{type}-{issue}-{slug}",
    author_source: "git",
    author_env_var: "USER",
  },
  progress: {
    file: "progress.txt",
    archive_threshold: 500,
    archive_dir: ".gent/archive",
  },
  claude: {
    permission_mode: "default",
    agent_file: "AGENT.md",
  },
  gemini: {
    sandbox_mode: "default",
    agent_file: "AGENT.md",
  },
  codex: {
    agent_file: "AGENT.md",
  },
  ai: {
    provider,
    auto_fallback: !!fallback,
    fallback_provider: fallback,
  },
  validation: ["npm run typecheck", "npm run lint"],
});

describe("ai-provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getProviderDisplayName", () => {
    it("returns Claude for claude provider", () => {
      expect(getProviderDisplayName("claude")).toBe("Claude");
    });

    it("returns Gemini for gemini provider", () => {
      expect(getProviderDisplayName("gemini")).toBe("Gemini");
    });

    it("returns Codex for codex provider", () => {
      expect(getProviderDisplayName("codex")).toBe("Codex");
    });
  });

  describe("invokeAI", () => {
    it("invokes codex with exec subcommand and default timeout", async () => {
      mockExeca.mockResolvedValue({ stdout: "test output" } as any);
      const config = createTestConfig("codex");
      const result = await invokeAI({ prompt: "test" }, config);
      expect(result.provider).toBe("codex");
      expect(result.output).toBe("test output");
      expect(mockExeca).toHaveBeenCalledWith("codex", ["exec", "test"], {
        timeout: AI_DEFAULT_TIMEOUT_MS,
      });
    });

    it("falls back to gemini if codex is rate limited", async () => {
      const rateLimitError = new Error("rate limited");
      (rateLimitError as any).exitCode = 2;
      mockExeca.mockRejectedValueOnce(rateLimitError);
      mockExeca.mockResolvedValue({ stdout: "fallback output" } as any);
      const config = createTestConfig("codex", "gemini");
      const result = await invokeAI({ prompt: "test" }, config);
      expect(result.provider).toBe("gemini");
      expect(result.output).toBe("fallback output");
      expect(mockExeca).toHaveBeenCalledTimes(2);
    });
  });

  describe("invokeAIInteractive", () => {
    it("invokes Claude with --permission-mode and prompt", async () => {
      const mockResult = { exitCode: 0 };
      mockExeca.mockReturnValueOnce(mockResult as never);

      const config = createTestConfig("claude");
      const prompt = "test prompt";

      const { provider } = await invokeAIInteractive(prompt, config);

      expect(provider).toBe("claude");
      expect(mockExeca).toHaveBeenCalledWith(
        "claude",
        ["--permission-mode", "default", "test prompt"],
        { stdio: "inherit" }
      );
    });

    it("invokes Gemini with -i flag for interactive mode", async () => {
      const mockResult = { exitCode: 0 };
      mockExeca.mockReturnValueOnce(mockResult as never);

      const config = createTestConfig("gemini");
      const prompt = "test prompt";
      const previousCI = process.env.CI;
      const previousCIToken = process.env.CI_TOKEN;
      process.env.CI = "true";
      process.env.CI_TOKEN = "abc123";

      const { provider } = await invokeAIInteractive(prompt, config);

      expect(provider).toBe("gemini");
      const call = mockExeca.mock.calls[0]?.[2] as {
        stdio?: string;
        env?: Record<string, string | undefined>;
      };
      expect(mockExeca).toHaveBeenCalledWith(
        "gemini",
        ["-i", "test prompt"],
        expect.objectContaining({ stdio: "inherit", env: expect.any(Object) })
      );
      expect(call.env).not.toHaveProperty("CI");
      expect(call.env).not.toHaveProperty("CI_TOKEN");
      expect(call.env).not.toHaveProperty("CONTINUOUS_INTEGRATION");

      if (previousCI === undefined) {
        delete process.env.CI;
      } else {
        process.env.CI = previousCI;
      }
      if (previousCIToken === undefined) {
        delete process.env.CI_TOKEN;
      } else {
        process.env.CI_TOKEN = previousCIToken;
      }
    });

    it("invokes Codex with prompt for interactive mode", async () => {
      const mockResult = { exitCode: 0 };
      mockExeca.mockReturnValueOnce(mockResult as never);

      const config = createTestConfig("codex");
      const prompt = "test prompt";

      const { provider } = await invokeAIInteractive(prompt, config);

      expect(provider).toBe("codex");
      expect(mockExeca).toHaveBeenCalledWith("codex", ["test prompt"], {
        stdio: "inherit",
      });
    });

    it("uses provider override when specified", async () => {
      const mockResult = { exitCode: 0 };
      mockExeca.mockReturnValueOnce(mockResult as never);

      const config = createTestConfig("claude");
      const prompt = "test prompt";

      const { provider } = await invokeAIInteractive(prompt, config, "gemini");

      expect(provider).toBe("gemini");
      expect(mockExeca).toHaveBeenCalledWith(
        "gemini",
        ["-i", "test prompt"],
        expect.objectContaining({ stdio: "inherit", env: expect.any(Object) })
      );
    });
  });

  describe("isTimeoutError", () => {
    it("returns true for execa timedOut error", () => {
      const error = { timedOut: true, message: "timed out" };
      expect(isTimeoutError(error)).toBe(true);
    });

    it("returns true for ETIMEDOUT error code", () => {
      const error = { code: "ETIMEDOUT", message: "connection timed out" };
      expect(isTimeoutError(error)).toBe(true);
    });

    it("returns false for null or undefined", () => {
      expect(isTimeoutError(null)).toBe(false);
      expect(isTimeoutError(undefined)).toBe(false);
    });

    it("returns false for non-timeout errors", () => {
      const error = { message: "some other error" };
      expect(isTimeoutError(error)).toBe(false);
    });

    it("returns false for rate limit errors (not timeout)", () => {
      const error = { exitCode: 2, message: "rate limit exceeded" };
      expect(isTimeoutError(error)).toBe(false);
    });
  });
});
