import { describe, it, expect, beforeEach, vi } from "vitest";
import { ThoughtVersionService } from "@/feature/thought-version/service/thought-version.service";
import { ThoughtRepository } from "@/feature/thought/repository/thought.repository";
import { ThoughtVersionRepository } from "@/feature/thought-version/repository/thought-version.repository";
import { ThoughtDiffRepository } from "@/feature/thought-diff/repository/thought-diff.repository";
import { Thought } from "@/feature/thought/thought.model";
import { ThoughtVersion } from "@/feature/thought-version/thought-version.model";
import { AppError, ErrorCode } from "@/common/errors/app-error";

describe("ThoughtVersionService", () => {
  let thoughtVersionService: ThoughtVersionService;
  let mockThoughtRepository: ThoughtRepository;
  let mockThoughtVersionRepository: ThoughtVersionRepository;
  let mockThoughtDiffRepository: ThoughtDiffRepository;
  let mockGenerateAiSummary: (
    oldContent: string,
    newContent: string,
    addedWords: string[],
    removedWords: string[],
    metrics: Record<string, unknown>
  ) => Promise<string>;

  beforeEach(() => {
    mockThoughtRepository = {
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as ThoughtRepository;

    mockThoughtVersionRepository = {
      findById: vi.fn(),
      findByThoughtId: vi.fn(),
      findLatestByThoughtId: vi.fn(),
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as ThoughtVersionRepository;

    mockThoughtDiffRepository = {
      findById: vi.fn(),
      findByVersionIds: vi.fn(),
      findByFromVersionId: vi.fn(),
      findByToVersionId: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    } as unknown as ThoughtDiffRepository;

    mockGenerateAiSummary = vi.fn();

    thoughtVersionService = new ThoughtVersionService(
      mockThoughtRepository,
      mockThoughtVersionRepository,
      mockThoughtDiffRepository,
      mockGenerateAiSummary
    );
  });

  describe("create", () => {
    it("should throw validation error when content is empty", async () => {
      const thoughtId = "thought-1";
      const data = { content: "" };

      await expect(
        thoughtVersionService.create(thoughtId, data)
      ).rejects.toThrow(AppError);
      await expect(
        thoughtVersionService.create(thoughtId, data)
      ).rejects.toMatchObject({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Content is required and cannot be empty",
      });
    });

    it("should throw not found error when thought does not exist", async () => {
      const thoughtId = "non-existent-thought";
      const data = { content: "New content" };

      vi.mocked(mockThoughtRepository.findById).mockResolvedValue(null);

      await expect(
        thoughtVersionService.create(thoughtId, data)
      ).rejects.toThrow(AppError);
      await expect(
        thoughtVersionService.create(thoughtId, data)
      ).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
        message: "Thought not found",
      });
    });

    it("should create first version successfully", async () => {
      const thoughtId = "thought-1";
      const data = { content: "First version content" };

      const thought: Thought = {
        id: thoughtId,
        title: "Test Thought",
        createdAt: new Date(),
      };

      const expectedVersion: ThoughtVersion = {
        id: "version-1",
        thoughtId,
        content: data.content,
        createdAt: new Date(),
        aiSummary: null,
        aiTags: [],
      };

      vi.mocked(mockThoughtRepository.findById).mockResolvedValue(thought);
      vi.mocked(
        mockThoughtVersionRepository.findLatestByThoughtId
      ).mockResolvedValue(null);
      vi.mocked(mockThoughtVersionRepository.create).mockResolvedValue(
        expectedVersion
      );

      const result = await thoughtVersionService.create(thoughtId, data);

      expect(result).toEqual(expectedVersion);
      expect(mockThoughtRepository.findById).toHaveBeenCalledWith(thoughtId);
      expect(
        mockThoughtVersionRepository.findLatestByThoughtId
      ).toHaveBeenCalledWith(thoughtId);
      expect(mockThoughtVersionRepository.create).toHaveBeenCalledWith({
        thoughtId,
        content: data.content,
      });
    });

    it("should create version with diff and AI summary", async () => {
      const thoughtId = "thought-1";
      const data = { content: "New version content" };

      const thought: Thought = {
        id: thoughtId,
        title: "Test Thought",
        createdAt: new Date(),
      };

      const lastVersion: ThoughtVersion = {
        id: "version-1",
        thoughtId,
        content: "Old version content",
        createdAt: new Date(),
        aiSummary: null,
        aiTags: [],
      };

      const newVersion: ThoughtVersion = {
        id: "version-2",
        thoughtId,
        content: data.content,
        createdAt: new Date(),
        aiSummary: null,
        aiTags: [],
      };

      const updatedVersion: ThoughtVersion = {
        ...newVersion,
        aiSummary: "AI generated summary",
      };

      vi.mocked(mockThoughtRepository.findById).mockResolvedValue(thought);
      vi.mocked(
        mockThoughtVersionRepository.findLatestByThoughtId
      ).mockResolvedValue(lastVersion);
      vi.mocked(mockThoughtVersionRepository.create).mockResolvedValue(
        newVersion
      );
      vi.mocked(mockGenerateAiSummary).mockResolvedValue(
        "AI generated summary"
      );
      vi.mocked(mockThoughtVersionRepository.update).mockResolvedValue(
        updatedVersion
      );

      const result = await thoughtVersionService.create(thoughtId, data);

      expect(result).toEqual(updatedVersion);
      expect(mockThoughtDiffRepository.create).toHaveBeenCalled();
      expect(mockGenerateAiSummary).toHaveBeenCalled();
      expect(mockThoughtVersionRepository.update).toHaveBeenCalledWith(
        newVersion.id,
        { aiSummary: "AI generated summary" }
      );
    });

    it("should return version without AI summary if generation fails", async () => {
      const thoughtId = "thought-1";
      const data = { content: "New version content" };

      const thought: Thought = {
        id: thoughtId,
        title: "Test Thought",
        createdAt: new Date(),
      };

      const lastVersion: ThoughtVersion = {
        id: "version-1",
        thoughtId,
        content: "Old version content",
        createdAt: new Date(),
        aiSummary: null,
        aiTags: [],
      };

      const newVersion: ThoughtVersion = {
        id: "version-2",
        thoughtId,
        content: data.content,
        createdAt: new Date(),
        aiSummary: null,
        aiTags: [],
      };

      vi.mocked(mockThoughtRepository.findById).mockResolvedValue(thought);
      vi.mocked(
        mockThoughtVersionRepository.findLatestByThoughtId
      ).mockResolvedValue(lastVersion);
      vi.mocked(mockThoughtVersionRepository.create).mockResolvedValue(
        newVersion
      );
      vi.mocked(mockGenerateAiSummary).mockRejectedValue(
        new Error("AI service error")
      );

      const result = await thoughtVersionService.create(thoughtId, data);

      expect(result).toEqual(newVersion);
      expect(mockThoughtDiffRepository.create).toHaveBeenCalled();
      expect(mockGenerateAiSummary).toHaveBeenCalled();
      expect(mockThoughtVersionRepository.update).not.toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("should list thought versions with pagination metadata", async () => {
      const createdAt = new Date();
      const filters = {
        page: 1,
        limit: 2,
        orderBy: "createdAt" as const,
        orderDirection: "desc" as const,
      };

      const versions: ThoughtVersion[] = [
        {
          id: "version-1",
          thoughtId: "thought-1",
          content: "First content",
          createdAt,
          aiSummary: null,
          aiTags: [],
        },
        {
          id: "version-2",
          thoughtId: "thought-2",
          content: "Second content",
          createdAt,
          aiSummary: null,
          aiTags: [],
        },
      ];

      vi.mocked(mockThoughtVersionRepository.list).mockResolvedValue({
        data: versions,
        total: 5,
      });

      const result = await thoughtVersionService.list(filters);

      expect(mockThoughtVersionRepository.list).toHaveBeenCalledWith(filters);
      expect(result).toEqual({
        data: versions,
        pagination: {
          page: 1,
          limit: 2,
          total: 5,
          totalPages: 3,
        },
      });
    });
  });
});
