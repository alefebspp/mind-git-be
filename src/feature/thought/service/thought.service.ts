import { ThoughtRepository } from "@/feature/thought/repository/thought.repository";
import { Thought } from "@/feature/thought/thought.model";
import { CreateThoughtData } from "@/feature/thought/thought.types";
import { AppError } from "@/common/errors/app-error";

export class ThoughtService {
  constructor(private thoughtRepository: ThoughtRepository) {}

  async create(data: CreateThoughtData): Promise<Thought> {
    if (!data.content || data.content.trim().length === 0) {
      throw AppError.validationError("Content is required and cannot be empty");
    }

    return await this.thoughtRepository.create(data);
  }
}
