import { diffWords } from "diff";

export type VersionDeltaMetrics = {
  addedWordsCount: number;
  removedWordsCount: number;
  totalChanges: number;
};

export type VersionDelta = {
  addedWords: string[];
  removedWords: string[];
  metrics: VersionDeltaMetrics;
};

function tokenizeChangedSegment(value: string): string[] {
  return value.split(/\s+/).filter((word) => word.length > 0);
}

/**
 * Computes word-level delta between two version contents for ThoughtDiff persistence.
 */
export function computeVersionDelta(
  fromContent: string,
  toContent: string
): VersionDelta {
  const wordDiff = diffWords(fromContent, toContent);

  const addedWords: string[] = [];
  const removedWords: string[] = [];

  for (const part of wordDiff) {
    if (part.added) {
      addedWords.push(...tokenizeChangedSegment(part.value));
    } else if (part.removed) {
      removedWords.push(...tokenizeChangedSegment(part.value));
    }
  }

  const metrics: VersionDeltaMetrics = {
    addedWordsCount: addedWords.length,
    removedWordsCount: removedWords.length,
    totalChanges: addedWords.length + removedWords.length,
  };

  return { addedWords, removedWords, metrics };
}
