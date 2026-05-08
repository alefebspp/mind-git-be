import { Thought } from "@/feature/thought/thought.model";
import { CreateThoughtData, UpdateThoughtData } from "@/feature/thought/thought.types";

export interface ThoughtRepository {
  findById(id: string): Promise<Thought | null>;
  findAll(): Promise<Thought[]>;
  create(data: CreateThoughtData): Promise<Thought>;
  update(id: string, data: UpdateThoughtData): Promise<Thought>;
  delete(id: string): Promise<void>;
}
