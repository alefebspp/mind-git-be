import OpenAI from "openai";
import { promises as fs } from "fs";
import * as path from "path";
import { AppError } from "@/common/errors/app-error";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateAiSummary(
  oldContent: string,
  newContent: string,
  addedWords: string[],
  removedWords: string[],
  metrics: Record<string, unknown>
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw AppError.internalError("OpenAI API key is not configured");
  }

  try {
    const promptTemplatePath = path.join(
      process.cwd(),
      "prompts",
      "thought-version-diff.md"
    );
    const promptTemplate = await fs.readFile(promptTemplatePath, "utf-8");

    const prompt = promptTemplate
      .replace("{oldExcerpt}", oldContent)
      .replace("{newExcerpt}", newContent)
      .replace("{addedWords}", addedWords.join(", "))
      .replace("{removedWords}", removedWords.join(", "))
      .replace("{metricsJson}", JSON.stringify(metrics, null, 2));

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    const summary = response.choices[0]?.message?.content?.trim() || "";

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
}
