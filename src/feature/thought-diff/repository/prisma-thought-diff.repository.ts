import { PrismaClient, Prisma } from "@prisma/client";
import { ThoughtDiff } from "@/feature/thought-diff/thought-diff.model";
import { ThoughtDiffRepository } from "./thought-diff.repository";

export class PrismaThoughtDiffRepository implements ThoughtDiffRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<ThoughtDiff | null> {
    const thoughtDiff = await this.prisma.thoughtDiff.findUnique({
      where: { id },
    });

    return thoughtDiff
      ? {
          ...thoughtDiff,
          metrics: thoughtDiff.metrics as Record<string, unknown>,
        }
      : null;
  }

  async findByVersionIds(
    fromVersionId: string,
    toVersionId: string
  ): Promise<ThoughtDiff | null> {
    const thoughtDiff = await this.prisma.thoughtDiff.findFirst({
      where: {
        fromVersionId,
        toVersionId,
      },
    });

    return thoughtDiff
      ? {
          ...thoughtDiff,
          metrics: thoughtDiff.metrics as Record<string, unknown>,
        }
      : null;
  }

  async findByFromVersionId(fromVersionId: string): Promise<ThoughtDiff[]> {
    const thoughtDiffs = await this.prisma.thoughtDiff.findMany({
      where: { fromVersionId },
      orderBy: { createdAt: "desc" },
    });

    return thoughtDiffs.map((thoughtDiff) => ({
      ...thoughtDiff,
      metrics: thoughtDiff.metrics as Record<string, unknown>,
    }));
  }

  async findByToVersionId(toVersionId: string): Promise<ThoughtDiff[]> {
    const thoughtDiffs = await this.prisma.thoughtDiff.findMany({
      where: { toVersionId },
      orderBy: { createdAt: "desc" },
    });

    return thoughtDiffs.map((thoughtDiff) => ({
      ...thoughtDiff,
      metrics: thoughtDiff.metrics as Record<string, unknown>,
    }));
  }

  async create(data: {
    fromVersionId: string;
    toVersionId: string;
    addedWords: string[];
    removedWords: string[];
    metrics: Record<string, unknown>;
  }): Promise<ThoughtDiff> {
    const thoughtDiff = await this.prisma.thoughtDiff.create({
      data: {
        fromVersionId: data.fromVersionId,
        toVersionId: data.toVersionId,
        addedWords: data.addedWords,
        removedWords: data.removedWords,
        metrics: data.metrics as Prisma.InputJsonValue,
      },
    });

    return {
      ...thoughtDiff,
      metrics: thoughtDiff.metrics as Record<string, unknown>,
    };
  }

  async delete(id: string): Promise<void> {
    await this.prisma.thoughtDiff.delete({
      where: { id },
    });
  }
}
