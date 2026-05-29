import { describe, it, expect, afterEach } from "vitest";
import { resolveAiSummaryProvider } from "@/feature/thought-version/service/ai-summary/create-generate-ai-summary";

describe("createGenerateAiSummary", () => {
  const originalProvider = process.env.AI_SUMMARY_PROVIDER;

  afterEach(() => {
    process.env.AI_SUMMARY_PROVIDER = originalProvider;
  });

  it("defaults to google when AI_SUMMARY_PROVIDER is unset", () => {
    delete process.env.AI_SUMMARY_PROVIDER;
    expect(resolveAiSummaryProvider()).toBe("google");
  });

  it("selects openai when AI_SUMMARY_PROVIDER is openai", () => {
    process.env.AI_SUMMARY_PROVIDER = "openai";
    expect(resolveAiSummaryProvider()).toBe("openai");
  });

});
