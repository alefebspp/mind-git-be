export interface ThoughtDiff {
  id: string;
  fromVersionId: string;
  toVersionId: string;
  addedWords: string[];
  removedWords: string[];
  metrics: Record<string, unknown>;
  createdAt: Date;
}
