import { Queue } from "bullmq";
import type IORedis from "ioredis";
import type { AiSummaryJobData } from "@/infrastructure/bullmq/ai-summary-job.types";
import { AI_SUMMARY_QUEUE } from "@/infrastructure/bullmq/queue-names";

export function createAiSummaryQueue(
  connection: IORedis
): Queue<AiSummaryJobData> {
  return new Queue<AiSummaryJobData>(AI_SUMMARY_QUEUE, { connection });
}
