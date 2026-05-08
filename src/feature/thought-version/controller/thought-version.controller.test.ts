import { describe, it, expect, beforeEach, vi } from "vitest";
import { FastifyRequest, FastifyReply } from "fastify";
import { ThoughtVersionController } from "@/feature/thought-version/controller/thought-version.controller";
import { ThoughtVersionService } from "@/feature/thought-version/service/thought-version.service";
import { ThoughtVersion } from "@/feature/thought-version/thought-version.model";
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
});
