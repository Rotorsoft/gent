import { describe, it, expect } from "vitest";
import { getProviderDisplayName } from "./ai-provider.js";

describe("ai-provider", () => {
  describe("getProviderDisplayName", () => {
    it("returns Claude for claude provider", () => {
      expect(getProviderDisplayName("claude")).toBe("Claude");
    });

    it("returns Gemini for gemini provider", () => {
      expect(getProviderDisplayName("gemini")).toBe("Gemini");
    });
  });
});
