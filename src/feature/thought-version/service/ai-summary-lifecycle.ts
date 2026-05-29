import { UnrecoverableError } from "bullmq";
import { formatAiSummaryFailureMessage } from "@/feature/thought-version/ai-summary-failure-message";
import { ThoughtDiff } from "@/feature/thought-diff/thought-diff.model";
import { ThoughtDiffRepository } from "@/feature/thought-diff/repository/thought-diff.repository";
import {
  AiSummaryLifecycleCode,
  AiSummaryLifecycleError,
  isPermanentLifecycleCode,
} from "@/feature/thought-version/service/ai-summary-lifecycle.errors";
import {
  AiSummaryStatus,
  ThoughtVersion,
} from "@/feature/thought-version/thought-version.model";
import { ThoughtVersionRepository } from "@/feature/thought-version/repository/thought-version.repository";
import type { GenerateAiSummary } from "@/feature/thought-version/thought-version.types";
import type {
  AiSummaryJobData,
  AiSummaryJobIntent,
} from "@/infrastructure/bullmq/ai-summary-job.types";

export type AiSummaryLifecycleDeps = {
  thoughtVersionRepository: ThoughtVersionRepository;
  thoughtDiffRepository: ThoughtDiffRepository;
  generateAiSummary: GenerateAiSummary;
};

export type ManualRetryPrepared =
  | { kind: "noop"; version: ThoughtVersion }
  | {
      kind: "enqueue";
      version: ThoughtVersion;
      job: AiSummaryJobData;
    };

function assertSummaryApplicable(version: ThoughtVersion): void {
  if (version.aiSummaryStatus === AiSummaryStatus.NOT_APPLICABLE) {
    throw new AiSummaryLifecycleError(AiSummaryLifecycleCode.NOT_APPLICABLE);
  }
  if (version.aiSummaryStatus === AiSummaryStatus.PROCESSING) {
    throw new AiSummaryLifecycleError(AiSummaryLifecycleCode.ALREADY_PROCESSING);
  }
}

async function resolveDiffForVersion(
  thoughtVersionId: string,
  thoughtDiffRepository: ThoughtDiffRepository,
  options: { diffId?: string }
): Promise<ThoughtDiff> {
  if (options.diffId) {
    const diff = await thoughtDiffRepository.findById(options.diffId);
    if (!diff || diff.toVersionId !== thoughtVersionId) {
      throw new AiSummaryLifecycleError(AiSummaryLifecycleCode.DIFF_NOT_FOUND);
    }
    return diff;
  }

  const diffs = await thoughtDiffRepository.findByToVersionId(thoughtVersionId);
  const diff = diffs[0];
  if (!diff) {
    throw new AiSummaryLifecycleError(AiSummaryLifecycleCode.NO_DIFF);
  }
  return diff;
}

async function assertFromVersionExists(
  diff: ThoughtDiff,
  thoughtVersionRepository: ThoughtVersionRepository
): Promise<void> {
  const fromVersion = await thoughtVersionRepository.findById(
    diff.fromVersionId
  );
  if (!fromVersion) {
    throw new AiSummaryLifecycleError(
      AiSummaryLifecycleCode.MISSING_FROM_VERSION
    );
  }
}

function claimAllowedStatuses(intent: AiSummaryJobIntent): AiSummaryStatus[] {
  return intent === "manual"
    ? [AiSummaryStatus.PENDING, AiSummaryStatus.FAILED]
    : [AiSummaryStatus.PENDING];
}

/**
 * Validates manual retry preconditions, normalizes FAILED → PENDING, and returns job payload.
 */
export async function prepareManualAiSummaryRetry(input: {
  thoughtId: string;
  version: ThoughtVersion;
  thoughtVersionRepository: ThoughtVersionRepository;
  thoughtDiffRepository: ThoughtDiffRepository;
}): Promise<ManualRetryPrepared> {
  const { thoughtId, version, thoughtVersionRepository, thoughtDiffRepository } =
    input;

  if (version.aiSummaryStatus === AiSummaryStatus.COMPLETED) {
    return { kind: "noop", version };
  }

  assertSummaryApplicable(version);

  const diff = await resolveDiffForVersion(
    version.id,
    thoughtDiffRepository,
    {}
  );
  await assertFromVersionExists(diff, thoughtVersionRepository);

  let versionForEnqueue = version;
  if (version.aiSummaryStatus === AiSummaryStatus.FAILED) {
    versionForEnqueue = await thoughtVersionRepository.update(version.id, {
      aiSummaryStatus: AiSummaryStatus.PENDING,
      aiSummaryErrorMessage: null,
    });
  }

  return {
    kind: "enqueue",
    version: versionForEnqueue,
    job: {
      thoughtId,
      thoughtVersionId: version.id,
      diffId: diff.id,
      intent: "manual",
    },
  };
}

export async function processAiSummaryJobLifecycle(
  data: AiSummaryJobData,
  deps: AiSummaryLifecycleDeps
): Promise<void> {
  const { thoughtVersionId, thoughtId, diffId, intent } = data;
  const { thoughtVersionRepository, thoughtDiffRepository, generateAiSummary } =
    deps;

  const version = await thoughtVersionRepository.findById(thoughtVersionId);
  if (!version || version.thoughtId !== thoughtId) {
    throw new AiSummaryLifecycleError(AiSummaryLifecycleCode.VERSION_MISMATCH);
  }

  if (version.aiSummaryStatus === AiSummaryStatus.COMPLETED) {
    return;
  }

  assertSummaryApplicable(version);

  const diff = await resolveDiffForVersion(
    thoughtVersionId,
    thoughtDiffRepository,
    { diffId }
  );

  const fromVersion = await thoughtVersionRepository.findById(
    diff.fromVersionId
  );
  if (!fromVersion) {
    throw new AiSummaryLifecycleError(
      AiSummaryLifecycleCode.MISSING_FROM_VERSION
    );
  }

  const allowedStatuses = claimAllowedStatuses(intent);

  const claimed = await thoughtVersionRepository.updateIfAiSummaryStatusIn(
    thoughtVersionId,
    allowedStatuses,
    {
      aiSummaryStatus: AiSummaryStatus.PROCESSING,
      aiSummaryErrorMessage: null,
    }
  );

  if (!claimed) {
    const refreshed =
      await thoughtVersionRepository.findById(thoughtVersionId);
    if (refreshed?.aiSummaryStatus === AiSummaryStatus.COMPLETED) {
      return;
    }
    throw new AiSummaryLifecycleError(AiSummaryLifecycleCode.CLAIM_FAILED);
  }

  const targetVersion: ThoughtVersion = claimed;

  try {
    const aiSummary = await generateAiSummary(
      fromVersion.content,
      targetVersion.content,
      diff.addedWords,
      diff.removedWords,
      diff.metrics
    );

    const persisted = await thoughtVersionRepository.updateIfAiSummaryStatusIn(
      thoughtVersionId,
      [AiSummaryStatus.PROCESSING],
      {
        aiSummary,
        aiSummaryStatus: AiSummaryStatus.COMPLETED,
        aiSummaryErrorMessage: null,
      }
    );

    if (!persisted) {
      throw new AiSummaryLifecycleError(AiSummaryLifecycleCode.LOST_OWNERSHIP);
    }
  } catch (error) {
    if (error instanceof AiSummaryLifecycleError) {
      if (error.code === AiSummaryLifecycleCode.LOST_OWNERSHIP) {
        await markAiSummaryFailedWhileProcessing(
          thoughtVersionRepository,
          thoughtVersionId,
          formatAiSummaryFailureMessage(error)
        );
      }
      throw error;
    }

    if (error instanceof UnrecoverableError) {
      await markAiSummaryFailedWhileProcessing(
        thoughtVersionRepository,
        thoughtVersionId,
        formatAiSummaryFailureMessage(error)
      );
      throw error;
    }

    await thoughtVersionRepository.updateIfAiSummaryStatusIn(
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

export function toWorkerJobError(error: unknown): Error {
  if (error instanceof AiSummaryLifecycleError) {
    if (isPermanentLifecycleCode(error.code)) {
      return new UnrecoverableError(error.message);
    }
    return new Error(error.message);
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error("AI summary job failed");
}

async function markAiSummaryFailedWhileProcessing(
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

export { isAiSummaryLifecycleError } from "@/feature/thought-version/service/ai-summary-lifecycle.errors";

export async function markAiSummaryTerminalFailure(
  deps: Pick<AiSummaryLifecycleDeps, "thoughtVersionRepository">,
  data: Pick<AiSummaryJobData, "thoughtVersionId">,
  errorMessage: string
): Promise<void> {
  await deps.thoughtVersionRepository.updateIfAiSummaryStatusIn(
    data.thoughtVersionId,
    [AiSummaryStatus.PENDING, AiSummaryStatus.PROCESSING],
    {
      aiSummaryStatus: AiSummaryStatus.FAILED,
      aiSummaryErrorMessage: errorMessage,
    }
  );
}
