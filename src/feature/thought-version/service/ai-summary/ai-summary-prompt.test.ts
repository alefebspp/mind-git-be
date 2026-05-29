import { describe, it, expect } from "vitest";
import { fillAiSummaryPrompt } from "@/feature/thought-version/service/ai-summary/ai-summary-prompt";

describe("fillAiSummaryPrompt", () => {
  it("substitutes all template placeholders", () => {
    const template =
      "old:{oldExcerpt} new:{newExcerpt} +{addedWords} -{removedWords} m:{metricsJson}";

    const prompt = fillAiSummaryPrompt(template, {
      oldContent: "before",
      newContent: "after",
      addedWords: ["alpha"],
      removedWords: ["beta"],
      metrics: { totalChanges: 2 },
    });

    expect(prompt).toContain("old:before");
    expect(prompt).toContain("new:after");
    expect(prompt).toContain("+alpha");
    expect(prompt).toContain("-beta");
    expect(prompt).toContain('"totalChanges": 2');
  });
});
