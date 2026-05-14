import { Queue, UnrecoverableError, Worker } from "bullmq";
import type IORedis from "ioredis";
import type { AiSummaryJobData } from "@/infrastructure/bullmq/ai-summary-job.types";
import {
  markAiSummaryFailedAfterRetries,
  processAiSummaryJob,
  type AiSummaryJobProcessorDeps,
} from "@/infrastructure/bullmq/ai-summary-job.processor";
import { formatAiSummaryFailureMessage } from "@/feature/thought-version/ai-summary-failure-message";
import {
  AI_SUMMARY_DLQ_QUEUE,
  AI_SUMMARY_QUEUE,
} from "@/infrastructure/bullmq/queue-names";

export type AiSummaryWorkerRuntime = {
  worker: Worker<AiSummaryJobData>;
  dlqQueue: Queue<Record<string, unknown>>;
  shutdown: () => Promise<void>;
};

export function createAiSummaryWorkerRuntime(
  connection: IORedis,
  deps: AiSummaryJobProcessorDeps
): AiSummaryWorkerRuntime {
  const workerConn = connection.duplicate();

  const dlqQueue = new Queue<Record<string, unknown>>(AI_SUMMARY_DLQ_QUEUE, {
    connection: connection.duplicate(),
  });

  const worker = new Worker<AiSummaryJobData>(
    AI_SUMMARY_QUEUE,
    async (job) => {
      await processAiSummaryJob(job.data, deps);
    },
    {
      connection: workerConn,
    }
  );

  worker.on("failed", async (job, err) => {
    if (!job?.data) {
      return;
    }

    const maxAttempts = job.opts.attempts ?? 1;
    const unrecoverable =
      err instanceof UnrecoverableError ||
      (err instanceof Error && err.name === "UnrecoverableError");
    const exhausted = job.attemptsMade >= maxAttempts;

    if (!unrecoverable && !exhausted) {
      return;
    }

    try {
      if (!unrecoverable && exhausted) {
        await markAiSummaryFailedAfterRetries(deps, job.data, failureDetail(err));
      }

      const diffId =
        typeof job.data.diffId === "string" ? job.data.diffId : undefined;

      await dlqQueue.add(
        "ai-summary-terminal-failure",
        {
          cause: unrecoverable ? "permanent" : "retries_exhausted",
          thoughtVersionId: job.data.thoughtVersionId,
          thoughtId: job.data.thoughtId,
          diffId: diffId ?? null,
          intent: job.data.intent,
          errorMessage: failureDetail(err),
          attemptsMade: job.attemptsMade,
          maxAttempts,
          timestamp: new Date().toISOString(),
        },
        { removeOnComplete: false }
      );
    } catch (dlqError) {
      console.error(
        {
          msg: "ai_summary_dlq_or_failure_persist_failed",
          thoughtVersionId: job.data.thoughtVersionId,
        },
        dlqError
      );
    }
  });

  return {
    worker,
    dlqQueue,
    shutdown: async () => {
      await worker.close();
      await dlqQueue.close();
      await workerConn.quit();
    },
  };
}

function failureDetail(err: unknown): string {
  if (err instanceof Error && err.message) {
    return formatAiSummaryFailureMessage(err);
  }
  return formatAiSummaryFailureMessage(err);
}
