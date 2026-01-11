import { describe, it, expect } from "vitest";
import { generateDefaultConfig } from "./config.js";

describe("config", () => {
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
});
