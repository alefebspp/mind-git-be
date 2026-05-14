import { AppError, ErrorCode } from "@/common/errors/app-error";

const AI_SUMMARY_FAILURE_GENERIC = "AI summary generation failed";
const AI_SUMMARY_ERROR_MAX_LEN = 500;

export function formatAiSummaryFailureMessage(error: unknown): string {
  if (error instanceof AppError && error.code === ErrorCode.INTERNAL_ERROR) {
    return AI_SUMMARY_FAILURE_GENERIC;
  }
  if (error instanceof AppError) {
    const trimmed = error.message.trim().replace(/\s+/g, " ");
    const truncated =
      trimmed.length > AI_SUMMARY_ERROR_MAX_LEN
        ? trimmed.slice(0, AI_SUMMARY_ERROR_MAX_LEN)
        : trimmed;
    return truncated || AI_SUMMARY_FAILURE_GENERIC;
  }
  return AI_SUMMARY_FAILURE_GENERIC;
}
