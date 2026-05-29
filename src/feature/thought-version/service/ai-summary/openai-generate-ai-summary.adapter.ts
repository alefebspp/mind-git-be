import OpenAI from "openai";
import { AppError } from "@/common/errors/app-error";
import { buildAiSummaryPrompt } from "@/feature/thought-version/service/ai-summary/ai-summary-prompt";
import type { GenerateAiSummary } from "@/feature/thought-version/thought-version.types";

let openaiClient: OpenAI | undefined;

function getOpenAiClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

export function createOpenAiGenerateAiSummary(): GenerateAiSummary {
  return async (
    oldContent,
    newContent,
    addedWords,
    removedWords,
    metrics
  ) => {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      throw AppError.internalError("OpenAI API key is not configured");
    }

    try {
      const prompt = await buildAiSummaryPrompt({
        oldContent,
        newContent,
        addedWords,
        removedWords,
        metrics,
      });

      const response = await getOpenAiClient().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 200,
      });

      const summary = response.choices[0]?.message?.content?.trim() ?? "";

      if (!summary) {
        throw AppError.internalError("Failed to generate AI summary");
      }

      return summary;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw AppError.internalError(
        `Failed to generate AI summary: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };
}
