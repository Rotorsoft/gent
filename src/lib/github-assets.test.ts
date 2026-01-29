import { describe, it, expect } from "vitest";
import { formatVideoMarkdown } from "./github-assets.js";

describe("github-assets", () => {
  describe("formatVideoMarkdown", () => {
    it("should format video URL as markdown with default title", () => {
      const url = "https://github.com/user-attachments/assets/abc123.webm";
      const markdown = formatVideoMarkdown(url);

      expect(markdown).toContain("## Demo Video");
      expect(markdown).toContain(url);
      expect(markdown).toContain("<video");
      expect(markdown).toContain("controls");
    });

    it("should use custom title when provided", () => {
      const url = "https://github.com/user-attachments/assets/abc123.webm";
      const markdown = formatVideoMarkdown(url, "UI Preview");

      expect(markdown).toContain("## UI Preview");
      expect(markdown).toContain(url);
    });

    it("should include video element with controls", () => {
      const url = "https://github.com/user-attachments/assets/abc123.webm";
      const markdown = formatVideoMarkdown(url);

      expect(markdown).toContain(`<video src="${url}"`);
      expect(markdown).toContain("controls");
      expect(markdown).toContain('width="100%"');
    });
  });
});
