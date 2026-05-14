import {
  AiSummaryStatus as DbAiSummaryStatus,
  OutboxEventType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import {
  AiSummaryStatus,
  ThoughtVersion,
} from "@/feature/thought-version/thought-version.model";
import type {
  CreateThoughtVersionWithDiffAndOutboxInput,
  CreateThoughtVersionWithDiffAndOutboxResult,
} from "@/feature/thought-version/repository/thought-version-creation.repository";
import type { ThoughtVersionCreationRepository } from "@/feature/thought-version/repository/thought-version-creation.repository";

type PrismaThoughtVersionRow = {
  id: string;
  thoughtId: string;
  content: string;
  createdAt: Date;
  aiSummary: string | null;
  aiTags: string[];
  aiSummaryStatus: DbAiSummaryStatus;
  aiSummaryErrorMessage: string | null;
};

function toDomain(row: PrismaThoughtVersionRow): ThoughtVersion {
  return {
    ...row,
    aiSummaryStatus: row.aiSummaryStatus as AiSummaryStatus,
  };
}

export class PrismaThoughtVersionCreationRepository
  implements ThoughtVersionCreationRepository
{
  constructor(private prisma: PrismaClient) {}

  async createWithDiffAndAiSummaryOutbox(
    input: CreateThoughtVersionWithDiffAndOutboxInput
  ): Promise<CreateThoughtVersionWithDiffAndOutboxResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      const thoughtVersion = await tx.thoughtVersion.create({
        data: {
          thoughtId: input.thoughtId,
          content: input.content,
          aiSummaryStatus: "PENDING",
        },
      });

      const thoughtDiff = await tx.thoughtDiff.create({
        data: {
          fromVersionId: input.fromVersionId,
          toVersionId: thoughtVersion.id,
          addedWords: input.addedWords,
          removedWords: input.removedWords,
          metrics: input.metrics as Prisma.InputJsonValue,
        },
      });

      const payload = {
        thoughtId: input.thoughtId,
        thoughtVersionId: thoughtVersion.id,
        fromVersionId: input.fromVersionId,
        diffId: thoughtDiff.id,
        intent: "auto",
      };

      await tx.outboxEvent.create({
        data: {
          eventType: OutboxEventType.AI_SUMMARY_REQUESTED,
          aggregateType: "ThoughtVersion",
          aggregateId: thoughtVersion.id,
          payload,
        },
      });

      return { thoughtVersion, thoughtDiffId: thoughtDiff.id };
    });

    return {
      thoughtVersion: toDomain(result.thoughtVersion as PrismaThoughtVersionRow),
      thoughtDiffId: result.thoughtDiffId,
    };
  }
}
