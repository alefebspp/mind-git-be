export type AiSummaryJobIntent = "auto" | "manual";

export type AiSummaryJobData = {
  thoughtId: string;
  thoughtVersionId: string;
  diffId: string;
  intent: AiSummaryJobIntent;
};
