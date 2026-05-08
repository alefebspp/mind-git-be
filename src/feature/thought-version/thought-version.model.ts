export interface ThoughtVersion {
  id: string;
  thoughtId: string;
  content: string;
  createdAt: Date;
  aiSummary: string | null;
  aiTags: string[];
}
