import { describe, expect, it } from "vitest";
import { parseAiCommand } from "../../src/modules/ai/ai-thread.command";

describe("parseAiCommand", () => {
  it("maps summarize prompts", () => {
    const parsed = parseAiCommand({ prompt: "@ai summarize it" });
    expect(parsed.commandType).toBe("SUMMARIZE");
  });

  it("maps explain prompts", () => {
    const parsed = parseAiCommand({ prompt: "please explain this" });
    expect(parsed.commandType).toBe("EXPLAIN");
  });

  it("maps translate prompts and infers target language", () => {
    const parsed = parseAiCommand({ prompt: "translate to Bengali" });
    expect(parsed.commandType).toBe("TRANSLATE");
    expect(parsed.translateTo?.toLowerCase()).toContain("bengali");
  });

  it("falls back to general prompts", () => {
    const parsed = parseAiCommand({ prompt: "what does this mean?" });
    expect(parsed.commandType).toBe("GENERAL");
  });
});

