import type { VersionDelta } from "@/feature/thought-diff/version-delta";
import { ThoughtVersion } from "@/feature/thought-version/thought-version.model";

export type CreateThoughtVersionWithDiffAndOutboxInput = {
  thoughtId: string;
  content: string;
  fromVersionId: string;
  versionDelta: VersionDelta;
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
