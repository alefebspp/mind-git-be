import { diffWords } from "diff";
import { ThoughtVersion } from "@/feature/thought-version/thought-version.model";
import { ThoughtVersionRepository } from "@/feature/thought-version/repository/thought-version.repository";
import { ThoughtDiffRepository } from "@/feature/thought-diff/repository/thought-diff.repository";
import {
  CreateThoughtVersionData,
  GenerateAiSummary,
  ListThoughtVersionsFilters,
  PaginatedThoughtVersions,
} from "@/feature/thought-version/thought-version.types";
import { ThoughtRepository } from "@/feature/thought/repository/thought.repository";
import { AppError } from "@/common/errors/app-error";

export class ThoughtVersionService {
  constructor(
    private thoughtRepository: ThoughtRepository,
    private thoughtVersionRepository: ThoughtVersionRepository,
    private thoughtDiffRepository: ThoughtDiffRepository,
    private generateAiSummary: GenerateAiSummary
  ) {}

  async list(
    filters: ListThoughtVersionsFilters
  ): Promise<PaginatedThoughtVersions> {
    const { data, total } = await this.thoughtVersionRepository.list(filters);
    const totalPages = total === 0 ? 0 : Math.ceil(total / filters.limit);

    return {
      data,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages,
      },
    };
  }

  async create(
    thoughtId: string,
    data: CreateThoughtVersionData
  ): Promise<ThoughtVersion> {
    if (!data.content || data.content.trim().length === 0) {
      throw AppError.validationError("Content is required and cannot be empty");
    }

    const thought = await this.thoughtRepository.findById(thoughtId);

    if (!thought) {
      throw AppError.notFound("Thought not found");
    }

    const lastVersion =
      await this.thoughtVersionRepository.findLatestByThoughtId(thoughtId);

    const newVersion = await this.thoughtVersionRepository.create({
      thoughtId,
      content: data.content,
    });

    if (lastVersion) {
      const diff = diffWords(lastVersion.content, data.content);

      const addedWords: string[] = [];
      const removedWords: string[] = [];

      diff.forEach((part) => {
        if (part.added) {
          const words = part.value
            .split(/\s+/)
            .filter((word) => word.length > 0);
          addedWords.push(...words);
        } else if (part.removed) {
          const words = part.value
            .split(/\s+/)
            .filter((word) => word.length > 0);
          removedWords.push(...words);
        }
      });

      const metrics = {
        addedWordsCount: addedWords.length,
        removedWordsCount: removedWords.length,
        totalChanges: addedWords.length + removedWords.length,
      };

      await this.thoughtDiffRepository.create({
        fromVersionId: lastVersion.id,
        toVersionId: newVersion.id,
        addedWords,
        removedWords,
        metrics,
      });

      try {
        const aiSummary = await this.generateAiSummary(
          lastVersion.content,
          data.content,
          addedWords,
          removedWords,
          metrics
        );

        const updatedVersion = await this.thoughtVersionRepository.update(
          newVersion.id,
          { aiSummary }
        );

        return updatedVersion;
      } catch (error) {
        console.error("Error generating AI summary:", error);
        return newVersion;
      }
    }

    return newVersion;
  }
}
