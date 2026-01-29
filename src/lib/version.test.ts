import { describe, it, expect } from "vitest";
import {
  getVersion,
  compareVersions,
  formatUpgradeNotification,
} from "./version.js";

describe("version", () => {
  describe("getVersion", () => {
    it("should return a valid semver string", () => {
      const version = getVersion();
      // Semver pattern: major.minor.patch with optional pre-release/build metadata
      const semverRegex = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;
      expect(version).toMatch(semverRegex);
    });

    it("should return a non-empty string", () => {
      const version = getVersion();
      expect(version).toBeTruthy();
      expect(typeof version).toBe("string");
      expect(version.length).toBeGreaterThan(0);
    });
  });

  describe("compareVersions", () => {
    it("should return 1 when first version is newer (major)", () => {
      expect(compareVersions("2.0.0", "1.0.0")).toBe(1);
      expect(compareVersions("10.0.0", "9.0.0")).toBe(1);
    });

    it("should return 1 when first version is newer (minor)", () => {
      expect(compareVersions("1.2.0", "1.1.0")).toBe(1);
      expect(compareVersions("1.10.0", "1.9.0")).toBe(1);
    });

    it("should return 1 when first version is newer (patch)", () => {
      expect(compareVersions("1.0.2", "1.0.1")).toBe(1);
      expect(compareVersions("1.0.10", "1.0.9")).toBe(1);
    });

    it("should return -1 when first version is older", () => {
      expect(compareVersions("1.0.0", "2.0.0")).toBe(-1);
      expect(compareVersions("1.1.0", "1.2.0")).toBe(-1);
      expect(compareVersions("1.0.1", "1.0.2")).toBe(-1);
    });

    it("should return 0 when versions are equal", () => {
      expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
      expect(compareVersions("2.5.3", "2.5.3")).toBe(0);
    });

    it("should ignore pre-release suffixes", () => {
      expect(compareVersions("1.0.0-alpha", "1.0.0")).toBe(0);
      expect(compareVersions("2.0.0-beta.1", "1.9.9")).toBe(1);
    });
  });

  describe("formatUpgradeNotification", () => {
    it("should format upgrade notification with versions", () => {
      const message = formatUpgradeNotification("1.0.0", "2.0.0");
      expect(message).toContain("1.0.0");
      expect(message).toContain("2.0.0");
      expect(message).toContain("npm install -g @rotorsoft/gent");
    });

    it("should include arrow between versions", () => {
      const message = formatUpgradeNotification("1.5.0", "1.6.0");
      expect(message).toContain("1.5.0 → 1.6.0");
    });
  });
});
