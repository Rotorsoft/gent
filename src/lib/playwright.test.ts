import { describe, it, expect } from "vitest";
import { hasUIChanges } from "./playwright.js";

describe("playwright", () => {
  describe("hasUIChanges", () => {
    it("should detect .tsx files as UI changes", () => {
      expect(hasUIChanges(["src/components/Button.tsx"])).toBe(true);
      expect(hasUIChanges(["app/page.tsx"])).toBe(true);
    });

    it("should detect .jsx files as UI changes", () => {
      expect(hasUIChanges(["src/App.jsx"])).toBe(true);
    });

    it("should detect .vue files as UI changes", () => {
      expect(hasUIChanges(["src/components/Modal.vue"])).toBe(true);
    });

    it("should detect .svelte files as UI changes", () => {
      expect(hasUIChanges(["src/routes/+page.svelte"])).toBe(true);
    });

    it("should detect CSS files as UI changes", () => {
      expect(hasUIChanges(["src/styles/main.css"])).toBe(true);
      expect(hasUIChanges(["src/components/Button.scss"])).toBe(true);
      expect(hasUIChanges(["src/theme.less"])).toBe(true);
    });

    it("should detect components directory as UI changes", () => {
      expect(hasUIChanges(["src/components/Header.ts"])).toBe(true);
      expect(hasUIChanges(["components/Footer.js"])).toBe(true);
    });

    it("should detect pages directory as UI changes", () => {
      expect(hasUIChanges(["src/pages/home.ts"])).toBe(true);
      expect(hasUIChanges(["pages/index.js"])).toBe(true);
    });

    it("should detect views directory as UI changes", () => {
      expect(hasUIChanges(["src/views/Dashboard.ts"])).toBe(true);
    });

    it("should detect layouts directory as UI changes", () => {
      expect(hasUIChanges(["src/layouts/MainLayout.ts"])).toBe(true);
    });

    it("should detect ui directory as UI changes", () => {
      expect(hasUIChanges(["src/ui/Card.ts"])).toBe(true);
    });

    it("should detect styles directory as UI changes", () => {
      expect(hasUIChanges(["styles/global.ts"])).toBe(true);
    });

    it("should not detect backend files as UI changes", () => {
      expect(hasUIChanges(["src/lib/api.ts"])).toBe(false);
      expect(hasUIChanges(["src/utils/helpers.ts"])).toBe(false);
      expect(hasUIChanges(["server/index.ts"])).toBe(false);
    });

    it("should not detect config files as UI changes", () => {
      expect(hasUIChanges(["package.json"])).toBe(false);
      expect(hasUIChanges(["tsconfig.json"])).toBe(false);
      expect(hasUIChanges([".env"])).toBe(false);
    });

    it("should not detect test files as UI changes", () => {
      expect(hasUIChanges(["src/lib/utils.test.ts"])).toBe(false);
    });

    it("should return false for empty file list", () => {
      expect(hasUIChanges([])).toBe(false);
    });

    it("should detect UI changes in mixed file list", () => {
      expect(
        hasUIChanges([
          "src/lib/api.ts",
          "src/components/Button.tsx",
          "README.md",
        ])
      ).toBe(true);
    });

    it("should be case-insensitive for directories", () => {
      expect(hasUIChanges(["src/Components/Button.ts"])).toBe(true);
      expect(hasUIChanges(["src/PAGES/home.ts"])).toBe(true);
      expect(hasUIChanges(["UI/Card.ts"])).toBe(true);
    });
  });
});
