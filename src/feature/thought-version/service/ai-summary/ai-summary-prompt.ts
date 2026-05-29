import { promises as fs } from "fs";
import * as path from "path";

export type AiSummaryPromptInput = {
  oldContent: string;
  newContent: string;
  addedWords: string[];
  removedWords: string[];
  metrics: Record<string, unknown>;
};

const PROMPT_FILE = "thought-version-diff.md";

export async function readAiSummaryPromptTemplate(): Promise<string> {
  const promptTemplatePath = path.join(
    process.cwd(),
    "prompts",
    PROMPT_FILE
  );
  return fs.readFile(promptTemplatePath, "utf-8");
}

export function fillAiSummaryPrompt(
  template: string,
  input: AiSummaryPromptInput
): string {
  return template
    .replace("{oldExcerpt}", input.oldContent)
    .replace("{newExcerpt}", input.newContent)
    .replace("{addedWords}", input.addedWords.join(", "))
    .replace("{removedWords}", input.removedWords.join(", "))
    .replace("{metricsJson}", JSON.stringify(input.metrics, null, 2));
}

export async function buildAiSummaryPrompt(
  input: AiSummaryPromptInput
): Promise<string> {
  const template = await readAiSummaryPromptTemplate();
  return fillAiSummaryPrompt(template, input);
}
