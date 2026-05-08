export const AiSummaryStatus = {
  NOT_APPLICABLE: "NOT_APPLICABLE",
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type AiSummaryStatus =
  (typeof AiSummaryStatus)[keyof typeof AiSummaryStatus];

export interface ThoughtVersion {
  id: string;
  thoughtId: string;
  content: string;
  createdAt: Date;
  aiSummary: string | null;
  aiTags: string[];
  aiSummaryStatus: AiSummaryStatus;
  aiSummaryErrorMessage: string | null;
}
