import { ThoughtVersion } from "@/feature/thought-version/thought-version.model";

export type CreateThoughtVersionWithDiffAndOutboxInput = {
  thoughtId: string;
  content: string;
  fromVersionId: string;
  addedWords: string[];
  removedWords: string[];
  metrics: Record<string, unknown>;
};

export type CreateThoughtVersionWithDiffAndOutboxResult = {
  thoughtVersion: ThoughtVersion;
  thoughtDiffId: string;
};

export interface ThoughtVersionCreationRepository {
  createWithDiffAndAiSummaryOutbox(
    input: CreateThoughtVersionWithDiffAndOutboxInput
  ): Promise<CreateThoughtVersionWithDiffAndOutboxResult>;
}
