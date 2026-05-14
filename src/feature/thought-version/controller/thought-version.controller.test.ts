import { describe, it, expect, beforeEach, vi } from "vitest";
import { FastifyRequest, FastifyReply } from "fastify";
import { ThoughtVersionController } from "@/feature/thought-version/controller/thought-version.controller";
import { ThoughtVersionService } from "@/feature/thought-version/service/thought-version.service";
import {
  AiSummaryStatus,
  ThoughtVersion,
} from "@/feature/thought-version/thought-version.model";
import { AppError } from "@/common/errors/app-error";
import { ZodError } from "zod";

describe("ThoughtVersionController", () => {
  let thoughtVersionController: ThoughtVersionController;
  let mockThoughtVersionService: ThoughtVersionService;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    mockThoughtVersionService = {
      create: vi.fn(),
      list: vi.fn(),
      retryAiSummary: vi.fn(),
    } as unknown as ThoughtVersionService;

    thoughtVersionController = new ThoughtVersionController(
      mockThoughtVersionService
    );

    mockRequest = {
      body: {},
      params: {},
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe("create", () => {
    it("should create a thought version successfully", async () => {
      const thoughtId = "thought-1";
      const requestBody = {
        content: "New version content",
      };

      const expectedVersion: ThoughtVersion = {
        id: "version-1",
        thoughtId,
        content: requestBody.content,
        createdAt: new Date(),
        aiSummary: null,
        aiTags: [],
        aiSummaryStatus: AiSummaryStatus.PENDING,
        aiSummaryErrorMessage: null,
      };

      mockRequest.params = { thoughtId };
      mockRequest.body = requestBody;
      vi.mocked(mockThoughtVersionService.create).mockResolvedValue(
        expectedVersion
      );

      await thoughtVersionController.create(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockThoughtVersionService.create).toHaveBeenCalledWith(
        thoughtId,
        requestBody
      );
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({ data: expectedVersion });
    });

    it("should throw ZodError when thoughtId is missing", async () => {
      mockRequest.params = {};
      mockRequest.body = {
        content: "New content",
      };

      await expect(
        thoughtVersionController.create(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).rejects.toThrow(ZodError);
    });

    it("should throw ZodError when content is missing", async () => {
      mockRequest.params = { thoughtId: "thought-1" };
      mockRequest.body = {};

      await expect(
        thoughtVersionController.create(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).rejects.toThrow(ZodError);
    });

    it("should throw ZodError when content is not a string", async () => {
      mockRequest.params = { thoughtId: "thought-1" };
      mockRequest.body = {
        content: 123,
      };

      await expect(
        thoughtVersionController.create(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).rejects.toThrow(ZodError);
    });

    it("should propagate AppError from service", async () => {
      const thoughtId = "non-existent";
      mockRequest.params = { thoughtId };
      mockRequest.body = {
        content: "New content",
      };

      const error = AppError.notFound("Thought not found");
      vi.mocked(mockThoughtVersionService.create).mockRejectedValue(error);

      await expect(
        thoughtVersionController.create(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).rejects.toThrow(AppError);
    });
  });

  describe("list", () => {
    it("should list thought versions successfully", async () => {
      const createdAt = new Date();
      mockRequest.query = {
        page: "1",
        limit: "10",
        orderBy: "createdAt",
        orderDirection: "desc",
        thoughtId: "thought-1",
      };

      const serviceResponse = {
        data: [
          {
            id: "version-1",
            thoughtId: "thought-1",
            content: "content",
            createdAt,
            aiSummary: null,
            aiTags: [],
            aiSummaryStatus: AiSummaryStatus.NOT_APPLICABLE,
            aiSummaryErrorMessage: null,
          },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      vi.mocked(mockThoughtVersionService.list).mockResolvedValue(
        serviceResponse
      );

      await thoughtVersionController.list(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockThoughtVersionService.list).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        orderBy: "createdAt",
        orderDirection: "desc",
        thoughtId: "thought-1",
      });
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith(serviceResponse);
    });

    it("should throw ZodError for invalid pagination query", async () => {
      mockRequest.query = {
        page: "0",
      };

      await expect(
        thoughtVersionController.list(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).rejects.toThrow(ZodError);
    });
  });

  describe("retryAiSummary", () => {
    it("delegates to service with params and responds 200", async () => {
      const payload: ThoughtVersion = {
        id: "v2",
        thoughtId: "t1",
        content: "c",
        createdAt: new Date(),
        aiSummary: "s",
        aiTags: [],
        aiSummaryStatus: AiSummaryStatus.COMPLETED,
        aiSummaryErrorMessage: null,
      };
      mockRequest.params = { thoughtId: "t1", versionId: "v2" };
      vi.mocked(mockThoughtVersionService.retryAiSummary).mockResolvedValue(
        payload
      );

      await thoughtVersionController.retryAiSummary(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockThoughtVersionService.retryAiSummary).toHaveBeenCalledWith(
        "t1",
        "v2"
      );
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({ data: payload });
    });

    it("throws ZodError when params are incomplete", async () => {
      mockRequest.params = { thoughtId: "t1" };
      await expect(
        thoughtVersionController.retryAiSummary(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).rejects.toThrow(ZodError);
    });

    it("propagates AppError from service", async () => {
      mockRequest.params = { thoughtId: "t1", versionId: "v9" };
      vi.mocked(mockThoughtVersionService.retryAiSummary).mockRejectedValue(
        AppError.unprocessableEntity("bad")
      );
      await expect(
        thoughtVersionController.retryAiSummary(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).rejects.toThrow(AppError);
    });
  });
});
