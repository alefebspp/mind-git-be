import { describe, it, expect, beforeEach, vi } from "vitest";
import { ThoughtService } from "@/feature/thought/service/thought.service";
import { ThoughtRepository } from "@/feature/thought/repository/thought.repository";
import { Thought } from "@/feature/thought/thought.model";
import { AppError, ErrorCode } from "@/common/errors/app-error";

describe("ThoughtService", () => {
  let thoughtService: ThoughtService;
  let mockRepository: ThoughtRepository;

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as ThoughtRepository;

    thoughtService = new ThoughtService(mockRepository);
  });

  describe("create", () => {
    it("should create a thought successfully", async () => {
      const thoughtData = {
        title: "Test Thought",
        content: "This is a test thought content",
      };

      const expectedThought: Thought = {
        id: "1",
        title: "Test Thought",
        createdAt: new Date(),
      };

      vi.mocked(mockRepository.create).mockResolvedValue(expectedThought);

      const result = await thoughtService.create(thoughtData);

      expect(result).toEqual(expectedThought);
      expect(mockRepository.create).toHaveBeenCalledWith(thoughtData);
    });

    it("should throw validation error when content is empty", async () => {
      const thoughtData = {
        title: "Test Thought",
        content: "",
      };

      await expect(thoughtService.create(thoughtData)).rejects.toThrow(
        AppError
      );
      await expect(thoughtService.create(thoughtData)).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Content is required and cannot be empty",
      });
    });

    it("should throw validation error when content is only whitespace", async () => {
      const thoughtData = {
        title: "Test Thought",
        content: "   ",
      };

      await expect(thoughtService.create(thoughtData)).rejects.toThrow(
        AppError
      );
      await expect(thoughtService.create(thoughtData)).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Content is required and cannot be empty",
      });
    });

    it("should throw validation error when content is not provided", async () => {
      const thoughtData = {
        title: "Test Thought",
        content: undefined as unknown as string,
      };

      await expect(thoughtService.create(thoughtData)).rejects.toThrow(
        AppError
      );
    });
  });
});
