import type { JobsOptions } from "bullmq";

export const DEFAULT_AI_SUMMARY_JOB_OPTIONS: Omit<JobsOptions, "jobId"> = {
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 30_000,
  },
  removeOnComplete: true,
  removeOnFail: false,
};
