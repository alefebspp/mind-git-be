import { computeVersionDelta } from "@/feature/thought-diff/version-delta";
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
import { isAiSummaryLifecycleError } from "@/feature/thought-version/service/ai-summary-lifecycle.errors";
import { prepareManualAiSummaryRetry } from "@/feature/thought-version/service/ai-summary-lifecycle";

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

    const versionDelta = computeVersionDelta(
      lastVersion.content,
      data.content
    );

    const { thoughtVersion } =
      await this.thoughtVersionCreationRepository.createWithDiffAndAiSummaryOutbox(
        {
          thoughtId,
          content: data.content,
          fromVersionId: lastVersion.id,
          versionDelta,
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

    try {
      const prepared = await prepareManualAiSummaryRetry({
        thoughtId,
        version,
        thoughtVersionRepository: this.thoughtVersionRepository,
        thoughtDiffRepository: this.thoughtDiffRepository,
      });

      if (prepared.kind === "noop") {
        return prepared.version;
      }

      await this.aiSummaryJobPublisher.enqueue(prepared.job);

      const refreshed =
        await this.thoughtVersionRepository.findById(versionId);
      return refreshed ?? prepared.version;
    } catch (error) {
      if (isAiSummaryLifecycleError(error)) {
        throw AppError.unprocessableEntity(error.message);
      }
      throw error;
    }
  }
}
