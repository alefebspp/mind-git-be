import { UnrecoverableError } from "bullmq";
import { formatAiSummaryFailureMessage } from "@/feature/thought-version/ai-summary-failure-message";
import {
  AiSummaryStatus,
  ThoughtVersion,
} from "@/feature/thought-version/thought-version.model";
import { ThoughtDiffRepository } from "@/feature/thought-diff/repository/thought-diff.repository";
import { ThoughtVersionRepository } from "@/feature/thought-version/repository/thought-version.repository";
import type { GenerateAiSummary } from "@/feature/thought-version/thought-version.types";
import type { AiSummaryJobData } from "@/infrastructure/bullmq/ai-summary-job.types";

export type AiSummaryJobProcessorDeps = {
  thoughtVersionRepository: ThoughtVersionRepository;
  thoughtDiffRepository: ThoughtDiffRepository;
  generateAiSummary: GenerateAiSummary;
};

export async function processAiSummaryJob(
  data: AiSummaryJobData,
  deps: AiSummaryJobProcessorDeps
): Promise<void> {
  const { thoughtVersionId, thoughtId, diffId, intent } = data;

  const version = await deps.thoughtVersionRepository.findById(thoughtVersionId);
  if (!version || version.thoughtId !== thoughtId) {
    throw new UnrecoverableError(
      "Thought version not found for AI summary job"
    );
  }

  if (version.aiSummaryStatus === AiSummaryStatus.COMPLETED) {
    return;
  }

  if (version.aiSummaryStatus === AiSummaryStatus.NOT_APPLICABLE) {
    throw new UnrecoverableError(
      "AI summary is not applicable for this version"
    );
  }

  if (version.aiSummaryStatus === AiSummaryStatus.PROCESSING) {
    throw new Error("AI summary is already processing for this version");
  }

  const diff = await deps.thoughtDiffRepository.findById(diffId);
  if (!diff || diff.toVersionId !== thoughtVersionId) {
    throw new UnrecoverableError(
      "Thought diff not found for AI summary job"
    );
  }

  const fromVersion = await deps.thoughtVersionRepository.findById(
    diff.fromVersionId
  );
  if (!fromVersion) {
    throw new UnrecoverableError(
      "Source version for diff is missing; cannot generate AI summary"
    );
  }

  const allowedStatuses: AiSummaryStatus[] =
    intent === "manual"
      ? [AiSummaryStatus.PENDING, AiSummaryStatus.FAILED]
      : [AiSummaryStatus.PENDING];

  const claimed = await deps.thoughtVersionRepository.updateIfAiSummaryStatusIn(
    thoughtVersionId,
    allowedStatuses,
    {
      aiSummaryStatus: AiSummaryStatus.PROCESSING,
      aiSummaryErrorMessage: null,
    }
  );

  if (!claimed) {
    const refreshed = await deps.thoughtVersionRepository.findById(
      thoughtVersionId
    );
    if (refreshed?.aiSummaryStatus === AiSummaryStatus.COMPLETED) {
      return;
    }
    throw new Error("Could not claim version for AI processing");
  }

  const targetVersion: ThoughtVersion = claimed;

  try {
    const aiSummary = await deps.generateAiSummary(
      fromVersion.content,
      targetVersion.content,
      diff.addedWords,
      diff.removedWords,
      diff.metrics
    );

    const persisted = await deps.thoughtVersionRepository.updateIfAiSummaryStatusIn(
      thoughtVersionId,
      [AiSummaryStatus.PROCESSING],
      {
        aiSummary,
        aiSummaryStatus: AiSummaryStatus.COMPLETED,
        aiSummaryErrorMessage: null,
      }
    );

    if (!persisted) {
      throw new Error("Lost ownership before persisting AI summary");
    }
  } catch (error) {
    if (error instanceof UnrecoverableError) {
      await markFailedProcessing(
        deps.thoughtVersionRepository,
        thoughtVersionId,
        formatAiSummaryFailureMessage(error)
      );
      throw error;
    }

    await deps.thoughtVersionRepository.updateIfAiSummaryStatusIn(
      thoughtVersionId,
      [AiSummaryStatus.PROCESSING],
      {
        aiSummaryStatus: AiSummaryStatus.PENDING,
        aiSummaryErrorMessage: null,
      }
    );

    throw error;
  }
}

async function markFailedProcessing(
  repo: ThoughtVersionRepository,
  thoughtVersionId: string,
  message: string
): Promise<void> {
  await repo.updateIfAiSummaryStatusIn(
    thoughtVersionId,
    [AiSummaryStatus.PROCESSING],
    {
      aiSummaryStatus: AiSummaryStatus.FAILED,
      aiSummaryErrorMessage: message,
    }
  );
}

/** When BullMQ exhausts retries, promote PENDING (post-revert) to FAILED. */
export async function markAiSummaryFailedAfterRetries(
  deps: AiSummaryJobProcessorDeps,
  data: AiSummaryJobData,
  errorMessage: string
): Promise<void> {
  await deps.thoughtVersionRepository.updateIfAiSummaryStatusIn(
    data.thoughtVersionId,
    [AiSummaryStatus.PENDING],
    {
      aiSummaryStatus: AiSummaryStatus.FAILED,
      aiSummaryErrorMessage: errorMessage,
    }
  );
}
