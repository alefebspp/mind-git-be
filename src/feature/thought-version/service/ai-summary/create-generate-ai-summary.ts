import { createGoogleGenerateAiSummary } from "@/feature/thought-version/service/ai-summary/google-generate-ai-summary.adapter";
import { createOpenAiGenerateAiSummary } from "@/feature/thought-version/service/ai-summary/openai-generate-ai-summary.adapter";
import type { GenerateAiSummary } from "@/feature/thought-version/thought-version.types";

export type AiSummaryProvider = "openai" | "google";

export function resolveAiSummaryProvider(): AiSummaryProvider {
  const raw = process.env.AI_SUMMARY_PROVIDER?.trim().toLowerCase();
  if (raw === "openai") {
    return "openai";
  }
  return "google";
}

export function createGenerateAiSummary(
  provider: AiSummaryProvider = resolveAiSummaryProvider()
): GenerateAiSummary {
  switch (provider) {
    case "openai":
      return createOpenAiGenerateAiSummary();
    case "google":
      return createGoogleGenerateAiSummary();
  }
}
