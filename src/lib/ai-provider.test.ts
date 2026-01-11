import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock execa
vi.mock("execa", () => ({
  execa: vi.fn(),
}));

import { execa } from "execa";
import { getProviderDisplayName, invokeAIInteractive } from "./ai-provider.js";
import type { GentConfig } from "../types/index.js";

const mockExeca = vi.mocked(execa);

// Minimal config for testing
const createTestConfig = (provider: "claude" | "gemini"): GentConfig => ({
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
  ai: {
    provider,
    auto_fallback: false,
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

      const { provider } = await invokeAIInteractive(prompt, config);

      expect(provider).toBe("gemini");
      expect(mockExeca).toHaveBeenCalledWith(
        "gemini",
        ["-i", "test prompt"],
        { stdio: "inherit" }
      );
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
        { stdio: "inherit" }
      );
    });
  });
});
