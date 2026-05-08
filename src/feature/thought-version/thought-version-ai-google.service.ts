import { GoogleGenerativeAI } from "@google/generative-ai";
import { promises as fs } from "fs";
import * as path from "path";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "");

export async function generateAiSummary(
  oldContent: string,
  newContent: string,
  addedWords: string[],
  removedWords: string[],
  metrics: Record<string, unknown>
): Promise<string> {
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

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-lite",
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 200,
    },
  });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const summary = response.text().trim();

  return summary;
}
