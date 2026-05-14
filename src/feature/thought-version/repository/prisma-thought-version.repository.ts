import type { AiSummaryStatus as PrismaAiSummaryStatus } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import {
  AiSummaryStatus,
  ThoughtVersion,
} from "@/feature/thought-version/thought-version.model";
import { ListThoughtVersionsFilters } from "@/feature/thought-version/thought-version.types";
import { ThoughtVersionRepository } from "./thought-version.repository";

type PrismaThoughtVersionRow = {
  id: string;
  thoughtId: string;
  content: string;
  createdAt: Date;
  aiSummary: string | null;
  aiTags: string[];
  aiSummaryStatus: PrismaAiSummaryStatus;
  aiSummaryErrorMessage: string | null;
};

function toPrismaAiSummaryStatus(
  status: AiSummaryStatus
): PrismaAiSummaryStatus {
  return status as unknown as PrismaAiSummaryStatus;
}

function toDomainThoughtVersion(row: PrismaThoughtVersionRow): ThoughtVersion {
  return {
    ...row,
    aiSummaryStatus: row.aiSummaryStatus as AiSummaryStatus,
  };
}

export class PrismaThoughtVersionRepository
  implements ThoughtVersionRepository
{
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<ThoughtVersion | null> {
    const thoughtVersion = await this.prisma.thoughtVersion.findUnique({
      where: { id },
    });

    return thoughtVersion
      ? toDomainThoughtVersion(thoughtVersion as PrismaThoughtVersionRow)
      : null;
  }

  async findByThoughtId(thoughtId: string): Promise<ThoughtVersion[]> {
    const thoughtVersions = await this.prisma.thoughtVersion.findMany({
      where: { thoughtId },
      orderBy: { createdAt: "desc" },
    });

    return thoughtVersions.map((v) =>
      toDomainThoughtVersion(v as PrismaThoughtVersionRow)
    );
  }

  async findLatestByThoughtId(
    thoughtId: string
  ): Promise<ThoughtVersion | null> {
    const thoughtVersion = await this.prisma.thoughtVersion.findFirst({
      where: { thoughtId },
      orderBy: { createdAt: "desc" },
    });

    return thoughtVersion
      ? toDomainThoughtVersion(thoughtVersion as PrismaThoughtVersionRow)
      : null;
  }

  async list(filters: ListThoughtVersionsFilters): Promise<{
    data: ThoughtVersion[];
    total: number;
  }> {
    const where = {
      ...(filters.thoughtId ? { thoughtId: filters.thoughtId } : {}),
      ...(filters.content
        ? { content: { contains: filters.content, mode: "insensitive" as const } }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.thoughtVersion.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { [filters.orderBy]: filters.orderDirection },
      }),
      this.prisma.thoughtVersion.count({ where }),
    ]);

    const data = rows.map((row) =>
      toDomainThoughtVersion(row as PrismaThoughtVersionRow)
    );
    return { data, total };
  }

  async create(data: {
    thoughtId: string;
    content: string;
    aiSummary?: string;
    aiTags?: string[];
    aiSummaryStatus?: AiSummaryStatus;
  }): Promise<ThoughtVersion> {
    const thoughtVersion = await this.prisma.thoughtVersion.create({
      data: {
        thoughtId: data.thoughtId,
        content: data.content,
        ...(data.aiSummary && { aiSummary: data.aiSummary }),
        ...(data.aiTags && { aiTags: data.aiTags }),
        ...(data.aiSummaryStatus !== undefined && {
          aiSummaryStatus: toPrismaAiSummaryStatus(data.aiSummaryStatus),
        }),
      },
    });

    return toDomainThoughtVersion(thoughtVersion as PrismaThoughtVersionRow);
  }

  async update(
    id: string,
    data: {
      content?: string;
      aiSummary?: string | null;
      aiTags?: string[];
      aiSummaryStatus?: AiSummaryStatus;
      aiSummaryErrorMessage?: string | null;
    }
  ): Promise<ThoughtVersion> {
    const thoughtVersion = await this.prisma.thoughtVersion.update({
      where: { id },
      data: {
        ...(data.content && { content: data.content }),
        ...(data.aiSummary !== undefined && { aiSummary: data.aiSummary }),
        ...(data.aiTags && { aiTags: data.aiTags }),
        ...(data.aiSummaryStatus !== undefined && {
          aiSummaryStatus: toPrismaAiSummaryStatus(data.aiSummaryStatus),
        }),
        ...(data.aiSummaryErrorMessage !== undefined && {
          aiSummaryErrorMessage: data.aiSummaryErrorMessage,
        }),
      },
    });

    return toDomainThoughtVersion(thoughtVersion as PrismaThoughtVersionRow);
  }

  async updateIfAiSummaryStatusIn(
    id: string,
    allowedStatuses: AiSummaryStatus[],
    data: {
      content?: string;
      aiSummary?: string | null;
      aiTags?: string[];
      aiSummaryStatus?: AiSummaryStatus;
      aiSummaryErrorMessage?: string | null;
    }
  ): Promise<ThoughtVersion | null> {
    const result = await this.prisma.thoughtVersion.updateMany({
      where: {
        id,
        aiSummaryStatus: {
          in: allowedStatuses.map((s) => toPrismaAiSummaryStatus(s)),
        },
      },
      data: {
        ...(data.content && { content: data.content }),
        ...(data.aiSummary !== undefined && { aiSummary: data.aiSummary }),
        ...(data.aiTags && { aiTags: data.aiTags }),
        ...(data.aiSummaryStatus !== undefined && {
          aiSummaryStatus: toPrismaAiSummaryStatus(data.aiSummaryStatus),
        }),
        ...(data.aiSummaryErrorMessage !== undefined && {
          aiSummaryErrorMessage: data.aiSummaryErrorMessage,
        }),
      },
    });

    if (result.count === 0) {
      return null;
    }

    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.thoughtVersion.delete({
      where: { id },
    });
  }
}
