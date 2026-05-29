export const AiSummaryLifecycleCode = {
  NOT_APPLICABLE: "NOT_APPLICABLE",
  ALREADY_PROCESSING: "ALREADY_PROCESSING",
  NO_DIFF: "NO_DIFF",
  MISSING_FROM_VERSION: "MISSING_FROM_VERSION",
  VERSION_MISMATCH: "VERSION_MISMATCH",
  DIFF_NOT_FOUND: "DIFF_NOT_FOUND",
  DIFF_MISMATCH: "DIFF_MISMATCH",
  CLAIM_FAILED: "CLAIM_FAILED",
  LOST_OWNERSHIP: "LOST_OWNERSHIP",
} as const;

export type AiSummaryLifecycleCode =
  (typeof AiSummaryLifecycleCode)[keyof typeof AiSummaryLifecycleCode];

const LIFECYCLE_MESSAGES: Record<AiSummaryLifecycleCode, string> = {
  [AiSummaryLifecycleCode.NOT_APPLICABLE]:
    "AI summary is not applicable for this version",
  [AiSummaryLifecycleCode.ALREADY_PROCESSING]:
    "AI summary is already processing for this version",
  [AiSummaryLifecycleCode.NO_DIFF]:
    "No diff recorded for this version; cannot regenerate AI summary",
  [AiSummaryLifecycleCode.MISSING_FROM_VERSION]:
    "Source version for diff is missing; cannot regenerate AI summary",
  [AiSummaryLifecycleCode.VERSION_MISMATCH]:
    "Thought version not found for AI summary job",
  [AiSummaryLifecycleCode.DIFF_NOT_FOUND]:
    "Thought diff not found for AI summary job",
  [AiSummaryLifecycleCode.DIFF_MISMATCH]:
    "Thought diff not found for AI summary job",
  [AiSummaryLifecycleCode.CLAIM_FAILED]:
    "Could not claim version for AI processing",
  [AiSummaryLifecycleCode.LOST_OWNERSHIP]:
    "Lost ownership before persisting AI summary",
};

export class AiSummaryLifecycleError extends Error {
  constructor(public readonly code: AiSummaryLifecycleCode) {
    super(LIFECYCLE_MESSAGES[code]);
    this.name = "AiSummaryLifecycleError";
    Object.setPrototypeOf(this, AiSummaryLifecycleError.prototype);
  }
}

export function isAiSummaryLifecycleError(
  error: unknown
): error is AiSummaryLifecycleError {
  return error instanceof AiSummaryLifecycleError;
}

/** Permanent job failures — map to BullMQ UnrecoverableError at the adapter. */
export function isPermanentLifecycleCode(code: AiSummaryLifecycleCode): boolean {
  return (
    code === AiSummaryLifecycleCode.NOT_APPLICABLE ||
    code === AiSummaryLifecycleCode.ALREADY_PROCESSING ||
    code === AiSummaryLifecycleCode.VERSION_MISMATCH ||
    code === AiSummaryLifecycleCode.DIFF_NOT_FOUND ||
    code === AiSummaryLifecycleCode.DIFF_MISMATCH ||
    code === AiSummaryLifecycleCode.MISSING_FROM_VERSION
  );
}
