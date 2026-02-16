import { describe, it, expect, vi } from "vitest";
import { generateDefaultConfig, generateDefaultPromptsFile, getPrompt, loadConfig } from "./config.js";
import { DEFAULT_PROMPTS } from "./default-prompts.js";

// Mock fs for loadConfig tests
vi.mock("node:fs", async () => {
  const actual = await vi.importActual("node:fs");
  return { ...actual };
});

describe("config", () => {
  describe("loadConfig", () => {
    it("should return valid defaults when no .gent.yml exists", () => {
      const config = loadConfig("/nonexistent/path");

      expect(config.version).toBe(1);
      expect(config.ai.provider).toBe("claude");
      expect(config.ai.auto_fallback).toBe(true);
      expect(config.branch.pattern).toBe("{author}/{type}-{issue}-{slug}");
      expect(config.github.labels.workflow.ready).toBe("ai-ready");
      expect(config.github.labels.types).toContain("feature");
      expect(config.progress.file).toBe("progress.txt");
      expect(config.claude.agent_file).toBe("AGENT.md");
      expect(config.video.enabled).toBe(true);
      expect(config.validation).toContain("npm run typecheck");
    });

    it("should return all required GentConfig fields when no config exists", () => {
      const config = loadConfig("/nonexistent/path");

      // Verify all top-level fields exist
      expect(config).toHaveProperty("version");
      expect(config).toHaveProperty("github");
      expect(config).toHaveProperty("branch");
      expect(config).toHaveProperty("progress");
      expect(config).toHaveProperty("claude");
      expect(config).toHaveProperty("gemini");
      expect(config).toHaveProperty("codex");
      expect(config).toHaveProperty("ai");
      expect(config).toHaveProperty("video");
      expect(config).toHaveProperty("validation");
    });
  });

  describe("generateDefaultConfig", () => {
    it("should generate valid YAML config", () => {
      const config = generateDefaultConfig();

      expect(config).toContain("version: 1");
      expect(config).toContain("ai-ready");
      expect(config).toContain("ai-in-progress");
      expect(config).toContain("ai-completed");
      expect(config).toContain("ai-blocked");
    });

    it("should include all label types", () => {
      const config = generateDefaultConfig();

      expect(config).toContain("feature");
      expect(config).toContain("fix");
      expect(config).toContain("refactor");
      expect(config).toContain("chore");
      expect(config).toContain("docs");
      expect(config).toContain("test");
    });

    it("should include branch pattern", () => {
      const config = generateDefaultConfig();

      expect(config).toContain("{author}/{type}-{issue}-{slug}");
    });

    it("should include progress settings", () => {
      const config = generateDefaultConfig();

      expect(config).toContain("progress.txt");
      expect(config).toContain("archive_threshold: 500");
    });

    it("should include AI provider settings", () => {
      const config = generateDefaultConfig();

      expect(config).toContain("# AI provider settings");
      expect(config).toContain('provider: "claude"');
      expect(config).toContain("auto_fallback: true");
    });
  });

  describe("getPrompt", () => {
    it("should return default prompt when no .gent-prompts.yml exists", () => {
      const result = getPrompt("ticket", { description: "test" }, "/nonexistent/path");
      expect(result).toContain("User Request: test");
    });

    it("should throw for unknown prompt key", () => {
      expect(() => getPrompt("nonexistent_key", {}, "/nonexistent/path")).toThrow("Unknown prompt key");
    });

    it("should leave unresolved variables as-is", () => {
      const result = getPrompt("commit", { issue_context: "test" }, "/nonexistent/path");
      // provider_name and provider_email are not provided, should stay as placeholders
      expect(result).toContain("{provider_name}");
      expect(result).toContain("{provider_email}");
    });

    it("should interpolate multiple variables", () => {
      const result = getPrompt("pr", {
        issue_section: "## Related Issue\n#1: Test\n\n",
        commits: "- feat: add feature",
        diff_summary: "2 files changed",
        close_reference: "Closes #1",
      }, "/nonexistent/path");
      expect(result).toContain("#1: Test");
      expect(result).toContain("feat: add feature");
      expect(result).toContain("2 files changed");
      expect(result).toContain("Closes #1");
    });
  });

  describe("generateDefaultPromptsFile", () => {
    it("should include all prompt keys", () => {
      const content = generateDefaultPromptsFile();
      for (const key of Object.keys(DEFAULT_PROMPTS)) {
        expect(content).toContain(`--- ${key} ---`);
      }
    });

    it("should include variable documentation", () => {
      const content = generateDefaultPromptsFile();
      expect(content).toContain("{description}");
      expect(content).toContain("{issue_number}");
      expect(content).toContain("{max_duration}");
    });

    it("should have a descriptive header", () => {
      const content = generateDefaultPromptsFile();
      expect(content).toContain("Gent Prompt Templates");
      expect(content).toContain("{variable_name}");
    });
  });
});
