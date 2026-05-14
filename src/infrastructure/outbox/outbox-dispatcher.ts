import { Queue } from "bullmq";
import type { AiSummaryJobData } from "@/infrastructure/bullmq/ai-summary-job.types";
import { aiSummaryDeterministicJobId } from "@/infrastructure/bullmq/ai-summary-job-id";
import { DEFAULT_AI_SUMMARY_JOB_OPTIONS } from "@/infrastructure/bullmq/ai-summary-job-options";
import type { OutboxRepository } from "@/infrastructure/outbox/outbox.repository";

const DEFAULT_BATCH_SIZE = 25;

export class OutboxDispatcher {
  private intervalId: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly outbox: OutboxRepository,
    private readonly queue: Queue<AiSummaryJobData>,
    private readonly options: {
      pollIntervalMs: number;
      batchSize?: number;
    }
  ) {}

  start(): void {
    if (this.intervalId !== undefined) {
      return;
    }
    void this.tick();
    this.intervalId = setInterval(() => {
      void this.tick();
    }, this.options.pollIntervalMs);
  }

  stop(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  async tick(): Promise<void> {
    const batchSize = this.options.batchSize ?? DEFAULT_BATCH_SIZE;
    const pending = await this.outbox.findPublishableBatch(batchSize);

    for (const event of pending) {
      await this.publishEvent(event.id, event.payload);
    }
  }

  private async publishEvent(
    outboxId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const jobData = parseJobPayload(payload);
    const jobId = aiSummaryDeterministicJobId(jobData.thoughtVersionId);

    try {
      await this.queue.add("generate", jobData, {
        ...DEFAULT_AI_SUMMARY_JOB_OPTIONS,
        jobId,
      });
      await this.outbox.markPublished(outboxId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown queue error";
      await this.outbox.recordPublishFailure(outboxId, message);
    }
  }
}

function parseJobPayload(payload: Record<string, unknown>): AiSummaryJobData {
  const thoughtId = payload.thoughtId;
  const thoughtVersionId = payload.thoughtVersionId;
  const diffId = payload.diffId;
  const intent = payload.intent;

  if (
    typeof thoughtId !== "string" ||
    typeof thoughtVersionId !== "string" ||
    typeof diffId !== "string" ||
    (intent !== "auto" && intent !== "manual")
  ) {
    throw new Error("Invalid outbox payload for AI summary job");
  }

  return { thoughtId, thoughtVersionId, diffId, intent };
}
