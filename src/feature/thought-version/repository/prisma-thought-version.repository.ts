import { PrismaClient } from "@prisma/client";
import { ThoughtVersion } from "@/feature/thought-version/thought-version.model";
import { ThoughtVersionRepository } from "./thought-version.repository";

export class PrismaThoughtVersionRepository
  implements ThoughtVersionRepository
{
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<ThoughtVersion | null> {
    const thoughtVersion = await this.prisma.thoughtVersion.findUnique({
      where: { id },
    });

    return thoughtVersion;
  }

  async findByThoughtId(thoughtId: string): Promise<ThoughtVersion[]> {
    const thoughtVersions = await this.prisma.thoughtVersion.findMany({
      where: { thoughtId },
      orderBy: { createdAt: "desc" },
    });

    return thoughtVersions;
  }

  async findLatestByThoughtId(
    thoughtId: string
  ): Promise<ThoughtVersion | null> {
    const thoughtVersion = await this.prisma.thoughtVersion.findFirst({
      where: { thoughtId },
      orderBy: { createdAt: "desc" },
    });

    return thoughtVersion;
  }

  async create(data: {
    thoughtId: string;
    content: string;
    aiSummary?: string;
    aiTags?: string[];
  }): Promise<ThoughtVersion> {
    const thoughtVersion = await this.prisma.thoughtVersion.create({
      data: {
        thoughtId: data.thoughtId,
        content: data.content,
        ...(data.aiSummary && { aiSummary: data.aiSummary }),
        ...(data.aiTags && { aiTags: data.aiTags }),
      },
    });

    return thoughtVersion;
  }

  async update(
    id: string,
    data: {
      content?: string;
      aiSummary?: string;
      aiTags?: string[];
    }
  ): Promise<ThoughtVersion> {
    const thoughtVersion = await this.prisma.thoughtVersion.update({
      where: { id },
      data: {
        ...(data.content && { content: data.content }),
        ...(data.aiSummary !== undefined && { aiSummary: data.aiSummary }),
        ...(data.aiTags && { aiTags: data.aiTags }),
      },
    });

    return thoughtVersion;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.thoughtVersion.delete({
      where: { id },
    });
  }
}
