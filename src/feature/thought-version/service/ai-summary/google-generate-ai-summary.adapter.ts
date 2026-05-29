import { GoogleGenerativeAI } from "@google/generative-ai";
import { AppError } from "@/common/errors/app-error";
import { buildAiSummaryPrompt } from "@/feature/thought-version/service/ai-summary/ai-summary-prompt";
import type { GenerateAiSummary } from "@/feature/thought-version/thought-version.types";

export function createGoogleGenerateAiSummary(): GenerateAiSummary {
  return async (
    oldContent,
    newContent,
    addedWords,
    removedWords,
    metrics
  ) => {
    if (!process.env.GOOGLE_API_KEY?.trim()) {
      throw AppError.internalError("Google API key is not configured");
    }

    try {
      const prompt = await buildAiSummaryPrompt({
        oldContent,
        newContent,
        addedWords,
        removedWords,
        metrics,
      });

      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-lite",
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 200,
        },
      });

      const result = await model.generateContent(prompt);
      const summary = result.response.text().trim();

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
