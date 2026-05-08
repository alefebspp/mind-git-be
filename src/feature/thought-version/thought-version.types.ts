import { ThoughtVersion } from "@/feature/thought-version/thought-version.model";

export interface CreateThoughtVersionData {
  content: string;
}

export type ThoughtVersionOrderBy = "createdAt" | "content";
export type ThoughtVersionOrderDirection = "asc" | "desc";

export interface ListThoughtVersionsFilters {
  thoughtId?: string;
  content?: string;
  page: number;
  limit: number;
  orderBy: ThoughtVersionOrderBy;
  orderDirection: ThoughtVersionOrderDirection;
}

export interface PaginatedThoughtVersions {
  data: ThoughtVersion[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GenerateAiSummary {
  (
    oldContent: string,
    newContent: string,
    addedWords: string[],
    removedWords: string[],
    metrics: Record<string, unknown>
  ): Promise<string>;
}
