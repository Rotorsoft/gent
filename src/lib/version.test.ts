import { describe, it, expect } from "vitest";
import { getVersion } from "./version.js";

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
});
