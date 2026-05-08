import {
  ThoughtVersion,
  AiSummaryStatus,
} from "@/feature/thought-version/thought-version.model";
import { ListThoughtVersionsFilters } from "@/feature/thought-version/thought-version.types";

export interface ThoughtVersionRepository {
  findById(id: string): Promise<ThoughtVersion | null>;
  findByThoughtId(thoughtId: string): Promise<ThoughtVersion[]>;
  findLatestByThoughtId(thoughtId: string): Promise<ThoughtVersion | null>;
  list(filters: ListThoughtVersionsFilters): Promise<{
    data: ThoughtVersion[];
    total: number;
  }>;
  create(data: {
    thoughtId: string;
    content: string;
    aiSummary?: string;
    aiTags?: string[];
    aiSummaryStatus?: AiSummaryStatus;
  }): Promise<ThoughtVersion>;
  update(
    id: string,
    data: {
      content?: string;
      aiSummary?: string | null;
      aiTags?: string[];
      aiSummaryStatus?: AiSummaryStatus;
      aiSummaryErrorMessage?: string | null;
    }
  ): Promise<ThoughtVersion>;
  delete(id: string): Promise<void>;
}
