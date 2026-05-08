import { ThoughtVersion } from "@/feature/thought-version/thought-version.model";

export interface ThoughtVersionRepository {
  findById(id: string): Promise<ThoughtVersion | null>;
  findByThoughtId(thoughtId: string): Promise<ThoughtVersion[]>;
  findLatestByThoughtId(thoughtId: string): Promise<ThoughtVersion | null>;
  create(data: {
    thoughtId: string;
    content: string;
    aiSummary?: string;
    aiTags?: string[];
  }): Promise<ThoughtVersion>;
  update(
    id: string,
    data: {
      content?: string;
      aiSummary?: string;
      aiTags?: string[];
    }
  ): Promise<ThoughtVersion>;
  delete(id: string): Promise<void>;
}
