import { diffWords } from "diff";
import {
  AiSummaryStatus,
  ThoughtVersion,
} from "@/feature/thought-version/thought-version.model";
import { ThoughtVersionRepository } from "@/feature/thought-version/repository/thought-version.repository";
import { ThoughtDiffRepository } from "@/feature/thought-diff/repository/thought-diff.repository";
import {
  CreateThoughtVersionData,
  GenerateAiSummary,
  ListThoughtVersionsFilters,
  PaginatedThoughtVersions,
} from "@/feature/thought-version/thought-version.types";
import { ThoughtRepository } from "@/feature/thought/repository/thought.repository";
import { AppError, ErrorCode } from "@/common/errors/app-error";

const AI_SUMMARY_FAILURE_GENERIC = "AI summary generation failed";
const AI_SUMMARY_ERROR_MAX_LEN = 500;

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
      aiSummaryStatus: lastVersion
        ? AiSummaryStatus.PENDING
        : AiSummaryStatus.NOT_APPLICABLE,
    });

    if (!lastVersion) {
      return newVersion;
    }

    const wordDiff = diffWords(lastVersion.content, data.content);

    const addedWords: string[] = [];
    const removedWords: string[] = [];

    wordDiff.forEach((part) => {
      if (part.added) {
        const words = part.value.split(/\s+/).filter((word) => word.length > 0);
        addedWords.push(...words);
      } else if (part.removed) {
        const words = part.value.split(/\s+/).filter((word) => word.length > 0);
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

    await this.thoughtVersionRepository.update(newVersion.id, {
      aiSummaryStatus: AiSummaryStatus.PROCESSING,
      aiSummaryErrorMessage: null,
    });

    try {
      const aiSummary = await this.generateAiSummary(
        lastVersion.content,
        data.content,
        addedWords,
        removedWords,
        metrics
      );

      return await this.thoughtVersionRepository.update(newVersion.id, {
        aiSummary,
        aiSummaryStatus: AiSummaryStatus.COMPLETED,
        aiSummaryErrorMessage: null,
      });
    } catch (error) {
      console.error("Error generating AI summary:", error);
      return await this.thoughtVersionRepository.update(newVersion.id, {
        aiSummaryStatus: AiSummaryStatus.FAILED,
        aiSummaryErrorMessage: this.formatAiSummaryFailureMessage(error),
      });
    }
  }

  async retryAiSummary(
    thoughtId: string,
    versionId: string
  ): Promise<ThoughtVersion> {
    const thought = await this.thoughtRepository.findById(thoughtId);
    if (!thought) {
      throw AppError.notFound("Thought not found");
    }

    const version = await this.thoughtVersionRepository.findById(versionId);
    if (!version || version.thoughtId !== thoughtId) {
      throw AppError.notFound("Thought version not found");
    }

    if (version.aiSummaryStatus === AiSummaryStatus.COMPLETED) {
      return version;
    }

    if (version.aiSummaryStatus === AiSummaryStatus.NOT_APPLICABLE) {
      throw AppError.unprocessableEntity(
        "AI summary is not applicable for this version"
      );
    }

    const diffs =
      await this.thoughtDiffRepository.findByToVersionId(versionId);
    const diff = diffs[0];
    if (!diff) {
      throw AppError.unprocessableEntity(
        "No diff recorded for this version; cannot regenerate AI summary"
      );
    }

    const fromVersion = await this.thoughtVersionRepository.findById(
      diff.fromVersionId
    );
    if (!fromVersion) {
      throw AppError.unprocessableEntity(
        "Source version for diff is missing; cannot regenerate AI summary"
      );
    }

    await this.thoughtVersionRepository.update(versionId, {
      aiSummaryStatus: AiSummaryStatus.PROCESSING,
      aiSummaryErrorMessage: null,
    });

    try {
      const aiSummary = await this.generateAiSummary(
        fromVersion.content,
        version.content,
        diff.addedWords,
        diff.removedWords,
        diff.metrics
      );

      return await this.thoughtVersionRepository.update(versionId, {
        aiSummary,
        aiSummaryStatus: AiSummaryStatus.COMPLETED,
        aiSummaryErrorMessage: null,
      });
    } catch (error) {
      console.error("Error generating AI summary (retry):", error);
      return await this.thoughtVersionRepository.update(versionId, {
        aiSummaryStatus: AiSummaryStatus.FAILED,
        aiSummaryErrorMessage: this.formatAiSummaryFailureMessage(error),
      });
    }
  }

  private formatAiSummaryFailureMessage(error: unknown): string {
    if (error instanceof AppError && error.code === ErrorCode.INTERNAL_ERROR) {
      return AI_SUMMARY_FAILURE_GENERIC;
    }
    if (error instanceof AppError) {
      const trimmed = error.message.trim().replace(/\s+/g, " ");
      const truncated =
        trimmed.length > AI_SUMMARY_ERROR_MAX_LEN
          ? trimmed.slice(0, AI_SUMMARY_ERROR_MAX_LEN)
          : trimmed;
      return truncated || AI_SUMMARY_FAILURE_GENERIC;
    }
    return AI_SUMMARY_FAILURE_GENERIC;
  }
}
