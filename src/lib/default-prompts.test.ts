import { describe, it, expect } from "vitest";
import { DEFAULT_PROMPTS, interpolate } from "./default-prompts.js";

describe("interpolate", () => {
  it("should replace single variable", () => {
    const result = interpolate("Hello {name}!", { name: "World" });
    expect(result).toBe("Hello World!");
  });

  it("should replace multiple variables", () => {
    const result = interpolate("{greeting} {name}!", {
      greeting: "Hello",
      name: "World",
    });
    expect(result).toBe("Hello World!");
  });

  it("should leave unresolved variables as-is", () => {
    const result = interpolate("Hello {name}, {unknown}!", { name: "World" });
    expect(result).toBe("Hello World, {unknown}!");
  });

  it("should handle empty variables object", () => {
    const result = interpolate("Hello {name}!", {});
    expect(result).toBe("Hello {name}!");
  });

  it("should handle template with no variables", () => {
    const result = interpolate("No variables here", { name: "World" });
    expect(result).toBe("No variables here");
  });

  it("should replace same variable multiple times", () => {
    const result = interpolate("{x} + {x} = {y}", { x: "1", y: "2" });
    expect(result).toBe("1 + 1 = 2");
  });

  it("should handle empty string variable value", () => {
    const result = interpolate("a{sep}b", { sep: "" });
    expect(result).toBe("ab");
  });

  it("should handle multiline templates", () => {
    const result = interpolate("line1: {a}\nline2: {b}", {
      a: "x",
      b: "y",
    });
    expect(result).toBe("line1: x\nline2: y");
  });
});

describe("DEFAULT_PROMPTS", () => {
  it("should have all expected prompt keys", () => {
    expect(DEFAULT_PROMPTS).toHaveProperty("ticket");
    expect(DEFAULT_PROMPTS).toHaveProperty("implementation");
    expect(DEFAULT_PROMPTS).toHaveProperty("pr");
    expect(DEFAULT_PROMPTS).toHaveProperty("commit_message");
    expect(DEFAULT_PROMPTS).toHaveProperty("commit");
    expect(DEFAULT_PROMPTS).toHaveProperty("video");
    expect(DEFAULT_PROMPTS).toHaveProperty("pr_video");
  });

  it("ticket template should contain expected variables", () => {
    expect(DEFAULT_PROMPTS.ticket).toContain("{description}");
    expect(DEFAULT_PROMPTS.ticket).toContain("{agent_instructions_section}");
    expect(DEFAULT_PROMPTS.ticket).toContain("{additional_hints_section}");
  });

  it("implementation template should contain expected variables", () => {
    expect(DEFAULT_PROMPTS.implementation).toContain("{issue_number}");
    expect(DEFAULT_PROMPTS.implementation).toContain("{issue_title}");
    expect(DEFAULT_PROMPTS.implementation).toContain("{issue_body}");
    expect(DEFAULT_PROMPTS.implementation).toContain("{validation_commands}");
    expect(DEFAULT_PROMPTS.implementation).toContain("{provider_name}");
    expect(DEFAULT_PROMPTS.implementation).toContain("{provider_email}");
    expect(DEFAULT_PROMPTS.implementation).toContain("{progress_file}");
  });

  it("pr template should contain expected variables", () => {
    expect(DEFAULT_PROMPTS.pr).toContain("{issue_section}");
    expect(DEFAULT_PROMPTS.pr).toContain("{commits}");
    expect(DEFAULT_PROMPTS.pr).toContain("{diff_summary}");
    expect(DEFAULT_PROMPTS.pr).toContain("{close_reference}");
  });

  it("commit template should contain expected variables", () => {
    expect(DEFAULT_PROMPTS.commit).toContain("{issue_context}");
    expect(DEFAULT_PROMPTS.commit).toContain("{provider_name}");
    expect(DEFAULT_PROMPTS.commit).toContain("{provider_email}");
  });

  it("pr_video template should contain max_duration variable", () => {
    expect(DEFAULT_PROMPTS.pr_video).toContain("{max_duration}");
  });
});
