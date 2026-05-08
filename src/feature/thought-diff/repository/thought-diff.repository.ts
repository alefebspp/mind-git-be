import { ThoughtDiff } from "@/feature/thought-diff/thought-diff.model";

export interface ThoughtDiffRepository {
  findById(id: string): Promise<ThoughtDiff | null>;
  findByVersionIds(
    fromVersionId: string,
    toVersionId: string
  ): Promise<ThoughtDiff | null>;
  findByFromVersionId(fromVersionId: string): Promise<ThoughtDiff[]>;
  findByToVersionId(toVersionId: string): Promise<ThoughtDiff[]>;
  create(data: {
    fromVersionId: string;
    toVersionId: string;
    addedWords: string[];
    removedWords: string[];
    metrics: Record<string, unknown>;
  }): Promise<ThoughtDiff>;
  delete(id: string): Promise<void>;
}
