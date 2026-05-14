import { Queue } from "bullmq";
import type { AiSummaryJobData } from "@/infrastructure/bullmq/ai-summary-job.types";
import { DEFAULT_AI_SUMMARY_JOB_OPTIONS } from "@/infrastructure/bullmq/ai-summary-job-options";
import { aiSummaryDeterministicJobId } from "@/infrastructure/bullmq/ai-summary-job-id";

const IN_FLIGHT_STATES = new Set([
  "waiting",
  "active",
  "delayed",
  "paused",
  "prioritized",
]);

export class AiSummaryJobPublisher {
  constructor(private readonly queue: Queue<AiSummaryJobData>) {}

  async enqueue(jobData: AiSummaryJobData): Promise<void> {
    const jobId = aiSummaryDeterministicJobId(jobData.thoughtVersionId);
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (IN_FLIGHT_STATES.has(state)) {
        return;
      }
      await existing.remove();
    }

    await this.queue.add("generate", jobData, {
      ...DEFAULT_AI_SUMMARY_JOB_OPTIONS,
      jobId,
    });
  }
}
