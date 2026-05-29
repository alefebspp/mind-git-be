import {
  markAiSummaryTerminalFailure,
  processAiSummaryJobLifecycle,
  toWorkerJobError,
  type AiSummaryLifecycleDeps,
} from "@/feature/thought-version/service/ai-summary-lifecycle";
import type { AiSummaryJobData } from "@/infrastructure/bullmq/ai-summary-job.types";

export type AiSummaryJobProcessorDeps = AiSummaryLifecycleDeps;

export async function processAiSummaryJob(
  data: AiSummaryJobData,
  deps: AiSummaryJobProcessorDeps
): Promise<void> {
  try {
    await processAiSummaryJobLifecycle(data, deps);
  } catch (error) {
    throw toWorkerJobError(error);
  }
}

export async function markAiSummaryFailedAfterRetries(
  deps: AiSummaryJobProcessorDeps,
  data: AiSummaryJobData,
  errorMessage: string
): Promise<void> {
  await markAiSummaryTerminalFailure(deps, data, errorMessage);
}
