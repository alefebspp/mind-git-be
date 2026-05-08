import { describe, it, expect, beforeEach, vi } from "vitest";
import { ThoughtVersionService } from "@/feature/thought-version/service/thought-version.service";
import { ThoughtRepository } from "@/feature/thought/repository/thought.repository";
import { ThoughtVersionRepository } from "@/feature/thought-version/repository/thought-version.repository";
import { ThoughtDiffRepository } from "@/feature/thought-diff/repository/thought-diff.repository";
import { Thought } from "@/feature/thought/thought.model";
import {
  AiSummaryStatus,
  ThoughtVersion,
} from "@/feature/thought-version/thought-version.model";
import { ThoughtDiff } from "@/feature/thought-diff/thought-diff.model";
import { AppError, ErrorCode } from "@/common/errors/app-error";

function versionBase(override: Partial<ThoughtVersion>): ThoughtVersion {
  return {
    id: "version-1",
    thoughtId: "thought-1",
    content: "content",
    createdAt: new Date(),
    aiSummary: null,
    aiTags: [],
    aiSummaryStatus: AiSummaryStatus.NOT_APPLICABLE,
    aiSummaryErrorMessage: null,
    ...override,
  };
}

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

      const expectedVersion = versionBase({
        id: "version-1",
        thoughtId,
        content: data.content,
      });

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
        aiSummaryStatus: AiSummaryStatus.NOT_APPLICABLE,
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

      const lastVersion = versionBase({
        id: "version-1",
        thoughtId,
        content: "Old version content",
        aiSummaryStatus: AiSummaryStatus.COMPLETED,
      });

      const newVersion = versionBase({
        id: "version-2",
        thoughtId,
        content: data.content,
        aiSummaryStatus: AiSummaryStatus.PENDING,
      });

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
      vi.mocked(mockThoughtVersionRepository.update).mockImplementation(
        async (_, updateData) => ({
          ...newVersion,
          ...updateData,
          aiSummary:
            updateData.aiSummary !== undefined
              ? updateData.aiSummary
              : newVersion.aiSummary,
          aiSummaryStatus:
            updateData.aiSummaryStatus ?? newVersion.aiSummaryStatus,
          aiSummaryErrorMessage:
            updateData.aiSummaryErrorMessage !== undefined
              ? updateData.aiSummaryErrorMessage
              : newVersion.aiSummaryErrorMessage,
        })
      );

      const result = await thoughtVersionService.create(thoughtId, data);

      expect(result.aiSummary).toBe("AI generated summary");
      expect(result.aiSummaryStatus).toBe(AiSummaryStatus.COMPLETED);
      expect(mockThoughtDiffRepository.create).toHaveBeenCalled();
      expect(mockGenerateAiSummary).toHaveBeenCalled();
      expect(mockThoughtVersionRepository.create).toHaveBeenCalledWith({
        thoughtId,
        content: data.content,
        aiSummaryStatus: AiSummaryStatus.PENDING,
      });
      expect(mockThoughtVersionRepository.update).toHaveBeenNthCalledWith(
        1,
        newVersion.id,
        {
          aiSummaryStatus: AiSummaryStatus.PROCESSING,
          aiSummaryErrorMessage: null,
        }
      );
      expect(mockThoughtVersionRepository.update).toHaveBeenNthCalledWith(
        2,
        newVersion.id,
        {
          aiSummary: "AI generated summary",
          aiSummaryStatus: AiSummaryStatus.COMPLETED,
          aiSummaryErrorMessage: null,
        }
      );
    });

    it("should persist FAILED status when AI generation fails", async () => {
      const thoughtId = "thought-1";
      const data = { content: "New version content" };

      const thought: Thought = {
        id: thoughtId,
        title: "Test Thought",
        createdAt: new Date(),
      };

      const lastVersion = versionBase({
        id: "version-1",
        thoughtId,
        content: "Old version content",
      });

      const newVersion = versionBase({
        id: "version-2",
        thoughtId,
        content: data.content,
        aiSummaryStatus: AiSummaryStatus.PENDING,
      });

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
      vi.mocked(mockThoughtVersionRepository.update).mockImplementation(
        async (_, updateData) => ({
          ...newVersion,
          ...updateData,
          aiSummaryStatus:
            updateData.aiSummaryStatus ?? newVersion.aiSummaryStatus,
          aiSummaryErrorMessage:
            updateData.aiSummaryErrorMessage !== undefined
              ? updateData.aiSummaryErrorMessage
              : newVersion.aiSummaryErrorMessage,
        })
      );

      const result = await thoughtVersionService.create(thoughtId, data);

      expect(result.aiSummaryStatus).toBe(AiSummaryStatus.FAILED);
      expect(result.aiSummaryErrorMessage).toBe(
        "AI summary generation failed"
      );
      expect(mockThoughtDiffRepository.create).toHaveBeenCalled();
      expect(mockGenerateAiSummary).toHaveBeenCalled();
      expect(mockThoughtVersionRepository.update).toHaveBeenNthCalledWith(
        1,
        newVersion.id,
        {
          aiSummaryStatus: AiSummaryStatus.PROCESSING,
          aiSummaryErrorMessage: null,
        }
      );
      expect(mockThoughtVersionRepository.update).toHaveBeenNthCalledWith(
        2,
        newVersion.id,
        {
          aiSummaryStatus: AiSummaryStatus.FAILED,
          aiSummaryErrorMessage: "AI summary generation failed",
        }
      );
    });
  });

  describe("retryAiSummary", () => {
    const thoughtId = "thought-1";
    const thought: Thought = {
      id: thoughtId,
      title: "T",
      createdAt: new Date(),
    };

    it("throws when thought does not exist", async () => {
      vi.mocked(mockThoughtRepository.findById).mockResolvedValue(null);
      await expect(
        thoughtVersionService.retryAiSummary(thoughtId, "v-any")
      ).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
        message: "Thought not found",
      });
    });

    it("throws when version missing or mismatched thought", async () => {
      vi.mocked(mockThoughtRepository.findById).mockResolvedValue(thought);
      vi.mocked(mockThoughtVersionRepository.findById).mockResolvedValue(null);
      await expect(
        thoughtVersionService.retryAiSummary(thoughtId, "v-missing")
      ).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
        message: "Thought version not found",
      });

      vi.mocked(mockThoughtVersionRepository.findById).mockResolvedValue(
        versionBase({ id: "v-wrong", thoughtId: "other" })
      );
      await expect(
        thoughtVersionService.retryAiSummary(thoughtId, "v-wrong")
      ).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });

    it("returns immediately when COMPLETED without calling AI", async () => {
      const v = versionBase({
        id: "v-done",
        thoughtId,
        aiSummaryStatus: AiSummaryStatus.COMPLETED,
      });
      vi.mocked(mockThoughtRepository.findById).mockResolvedValue(thought);
      vi.mocked(mockThoughtVersionRepository.findById).mockResolvedValue(v);

      const result = await thoughtVersionService.retryAiSummary(thoughtId, v.id);

      expect(result).toEqual(v);
      expect(mockThoughtDiffRepository.findByToVersionId).not.toHaveBeenCalled();
      expect(mockGenerateAiSummary).not.toHaveBeenCalled();
    });

    it("throws 422 when NOT_APPLICABLE", async () => {
      vi.mocked(mockThoughtRepository.findById).mockResolvedValue(thought);
      vi.mocked(mockThoughtVersionRepository.findById).mockResolvedValue(
        versionBase({
          id: "v-first",
          thoughtId,
          aiSummaryStatus: AiSummaryStatus.NOT_APPLICABLE,
        })
      );

      await expect(
        thoughtVersionService.retryAiSummary(thoughtId, "v-first")
      ).rejects.toMatchObject({
        code: ErrorCode.UNPROCESSABLE_ENTITY,
      });
      expect(mockThoughtDiffRepository.findByToVersionId).not.toHaveBeenCalled();
    });

    it("throws 422 when no ThoughtDiff exists for version", async () => {
      vi.mocked(mockThoughtRepository.findById).mockResolvedValue(thought);
      vi.mocked(mockThoughtVersionRepository.findById).mockResolvedValue(
        versionBase({
          id: "v-target",
          thoughtId,
          aiSummaryStatus: AiSummaryStatus.FAILED,
        })
      );
      vi.mocked(mockThoughtDiffRepository.findByToVersionId).mockResolvedValue(
        []
      );

      await expect(
        thoughtVersionService.retryAiSummary(thoughtId, "v-target")
      ).rejects.toMatchObject({
        code: ErrorCode.UNPROCESSABLE_ENTITY,
        message:
          "No diff recorded for this version; cannot regenerate AI summary",
      });
    });

    it("throws 422 when fromVersion is missing", async () => {
      const diffRow: ThoughtDiff = {
        id: "diff-1",
        fromVersionId: "missing-from",
        toVersionId: "v-target",
        addedWords: [],
        removedWords: [],
        metrics: {},
        createdAt: new Date(),
      };
      vi.mocked(mockThoughtRepository.findById).mockResolvedValue(thought);
      vi.mocked(mockThoughtVersionRepository.findById).mockImplementation(
        async (id: string) => {
          if (id === "v-target") {
            return versionBase({
              id: "v-target",
              thoughtId,
              content: "new",
              aiSummaryStatus: AiSummaryStatus.PENDING,
            });
          }
          return null;
        }
      );
      vi.mocked(mockThoughtDiffRepository.findByToVersionId).mockResolvedValue([
        diffRow,
      ]);

      await expect(
        thoughtVersionService.retryAiSummary(thoughtId, "v-target")
      ).rejects.toMatchObject({
        code: ErrorCode.UNPROCESSABLE_ENTITY,
        message:
          "Source version for diff is missing; cannot regenerate AI summary",
      });
    });

    it("regenerates summary when diff exists", async () => {
      const diffRow: ThoughtDiff = {
        id: "diff-1",
        fromVersionId: "v-from",
        toVersionId: "v-target",
        addedWords: ["x"],
        removedWords: ["y"],
        metrics: { n: 1 },
        createdAt: new Date(),
      };
      const fromV = versionBase({
        id: "v-from",
        thoughtId,
        content: "old text",
      });
      const target = versionBase({
        id: "v-target",
        thoughtId,
        content: "new text",
        aiSummaryStatus: AiSummaryStatus.FAILED,
      });

      vi.mocked(mockThoughtRepository.findById).mockResolvedValue(thought);
      vi.mocked(mockThoughtVersionRepository.findById).mockImplementation(
        async (id: string) => {
          if (id === "v-target") {
            return target;
          }
          if (id === "v-from") {
            return fromV;
          }
          return null;
        }
      );
      vi.mocked(mockThoughtDiffRepository.findByToVersionId).mockResolvedValue([
        diffRow,
      ]);
      vi.mocked(mockGenerateAiSummary).mockResolvedValue("retried summary");
      vi.mocked(mockThoughtVersionRepository.update).mockImplementation(
        async (_, updateData) => ({
          ...target,
          ...updateData,
          aiSummary:
            updateData.aiSummary !== undefined
              ? updateData.aiSummary
              : target.aiSummary,
          aiSummaryStatus:
            updateData.aiSummaryStatus ?? target.aiSummaryStatus,
          aiSummaryErrorMessage:
            updateData.aiSummaryErrorMessage !== undefined
              ? updateData.aiSummaryErrorMessage
              : target.aiSummaryErrorMessage,
        })
      );

      const result = await thoughtVersionService.retryAiSummary(
        thoughtId,
        "v-target"
      );

      expect(mockGenerateAiSummary).toHaveBeenCalledWith(
        "old text",
        "new text",
        ["x"],
        ["y"],
        diffRow.metrics
      );
      expect(result.aiSummary).toBe("retried summary");
      expect(result.aiSummaryStatus).toBe(AiSummaryStatus.COMPLETED);
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
        versionBase({
          id: "version-1",
          thoughtId: "thought-1",
          content: "First content",
          createdAt,
        }),
        versionBase({
          id: "version-2",
          thoughtId: "thought-2",
          content: "Second content",
          createdAt,
        }),
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
