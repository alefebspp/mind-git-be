export interface CreateThoughtVersionData {
  content: string;
}

export interface GenerateAiSummary {
  (
    oldContent: string,
    newContent: string,
    addedWords: string[],
    removedWords: string[],
    metrics: Record<string, unknown>
  ): Promise<string>;
}
