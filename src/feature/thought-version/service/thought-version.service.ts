import { diffWords } from "diff";
import {
  AiSummaryStatus,
  ThoughtVersion,
} from "@/feature/thought-version/thought-version.model";
import { ThoughtVersionRepository } from "@/feature/thought-version/repository/thought-version.repository";
import { ThoughtDiffRepository } from "@/feature/thought-diff/repository/thought-diff.repository";
import {
  CreateThoughtVersionData,
  ListThoughtVersionsFilters,
  PaginatedThoughtVersions,
} from "@/feature/thought-version/thought-version.types";
import { ThoughtRepository } from "@/feature/thought/repository/thought.repository";
import { AppError } from "@/common/errors/app-error";
import type { ThoughtVersionCreationRepository } from "@/feature/thought-version/repository/thought-version-creation.repository";
import type { AiSummaryJobPublisher } from "@/infrastructure/bullmq/ai-summary-job.publisher";

export class ThoughtVersionService {
  constructor(
    private thoughtRepository: ThoughtRepository,
    private thoughtVersionRepository: ThoughtVersionRepository,
    private thoughtDiffRepository: ThoughtDiffRepository,
    private thoughtVersionCreationRepository: ThoughtVersionCreationRepository,
    private aiSummaryJobPublisher: AiSummaryJobPublisher
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

    if (!lastVersion) {
      return this.thoughtVersionRepository.create({
        thoughtId,
        content: data.content,
        aiSummaryStatus: AiSummaryStatus.NOT_APPLICABLE,
      });
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

    const { thoughtVersion } =
      await this.thoughtVersionCreationRepository.createWithDiffAndAiSummaryOutbox(
        {
          thoughtId,
          content: data.content,
          fromVersionId: lastVersion.id,
          addedWords,
          removedWords,
          metrics,
        }
      );

    return thoughtVersion;
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

    if (version.aiSummaryStatus === AiSummaryStatus.PROCESSING) {
      throw AppError.unprocessableEntity(
        "AI summary is already processing for this version"
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

    if (version.aiSummaryStatus === AiSummaryStatus.FAILED) {
      await this.thoughtVersionRepository.update(versionId, {
        aiSummaryStatus: AiSummaryStatus.PENDING,
        aiSummaryErrorMessage: null,
      });
    }

    await this.aiSummaryJobPublisher.enqueue({
      thoughtId,
      thoughtVersionId: versionId,
      diffId: diff.id,
      intent: "manual",
    });

    const refreshed =
      await this.thoughtVersionRepository.findById(versionId);
    return refreshed!;
  }
}
