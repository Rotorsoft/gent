import { describe, it, expect, vi } from "vitest";
import { execa } from "execa";
import { checkLabelsExist } from "./github.js";

vi.mock("execa");

describe("checkLabelsExist", () => {
  it("returns true when all workflow labels exist", async () => {
    vi.mocked(execa).mockResolvedValue({
      stdout: JSON.stringify([
        { name: "ai-ready" },
        { name: "ai-in-progress" },
        { name: "ai-completed" },
        { name: "ai-blocked" },
        { name: "type:feature" },
      ]),
    } as any);

    expect(await checkLabelsExist()).toBe(true);
  });

  it("returns false when some workflow labels are missing", async () => {
    vi.mocked(execa).mockResolvedValue({
      stdout: JSON.stringify([
        { name: "ai-ready" },
        { name: "type:feature" },
      ]),
    } as any);

    expect(await checkLabelsExist()).toBe(false);
  });

  it("returns false when no labels exist", async () => {
    vi.mocked(execa).mockResolvedValue({
      stdout: "[]",
    } as any);

    expect(await checkLabelsExist()).toBe(false);
  });

  it("returns false when gh command fails", async () => {
    vi.mocked(execa).mockRejectedValue(new Error("gh not found"));

    expect(await checkLabelsExist()).toBe(false);
  });
});
