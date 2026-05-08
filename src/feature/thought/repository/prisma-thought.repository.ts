import { PrismaClient } from "@prisma/client";
import { Thought } from "@/feature/thought/thought.model";
import { CreateThoughtData, UpdateThoughtData } from "@/feature/thought/thought.types";
import { ThoughtRepository } from "./thought.repository";

export class PrismaThoughtRepository implements ThoughtRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string): Promise<Thought | null> {
    const thought = await this.prisma.thought.findUnique({
      where: { id },
    });

    return thought;
  }

  async findAll(): Promise<Thought[]> {
    const thoughts = await this.prisma.thought.findMany({
      orderBy: { createdAt: "desc" },
    });

    return thoughts;
  }

  async create(data: CreateThoughtData): Promise<Thought> {
    const thought = await this.prisma.thought.create({
      data: {
        title: data.title || "",
        versions: {
          create: {
            content: data.content,
          },
        },
      },
    });

    return thought;
  }

  async update(id: string, data: UpdateThoughtData): Promise<Thought> {
    const thought = await this.prisma.thought.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
      },
    });

    return thought;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.thought.delete({
      where: { id },
    });
  }
}
