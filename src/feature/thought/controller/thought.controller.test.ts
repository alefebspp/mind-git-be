import { describe, it, expect, beforeEach, vi } from "vitest";
import { FastifyRequest, FastifyReply } from "fastify";
import { ThoughtController } from "@/feature/thought/controller/thought.controller";
import { ThoughtService } from "@/feature/thought/service/thought.service";
import { Thought } from "@/feature/thought/thought.model";
import { AppError } from "@/common/errors/app-error";
import { ZodError } from "zod";

describe("ThoughtController", () => {
  let thoughtController: ThoughtController;
  let mockThoughtService: ThoughtService;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    mockThoughtService = {
      create: vi.fn(),
    } as unknown as ThoughtService;

    thoughtController = new ThoughtController(mockThoughtService);

    mockRequest = {
      body: {},
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe("create", () => {
    it("should create a thought successfully", async () => {
      const requestBody = {
        title: "Test Thought",
        content: "Test content",
      };

      const expectedThought: Thought = {
        id: "1",
        title: "Test Thought",
        createdAt: new Date(),
      };

      mockRequest.body = requestBody;
      vi.mocked(mockThoughtService.create).mockResolvedValue(expectedThought);

      await thoughtController.create(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockThoughtService.create).toHaveBeenCalledWith(requestBody);
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith({ data: expectedThought });
    });

    it("should throw ZodError when body is invalid", async () => {
      mockRequest.body = {
        // missing required content field
        title: "Test",
      };

      await expect(
        thoughtController.create(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).rejects.toThrow(ZodError);
    });

    it("should throw ZodError when content is not a string", async () => {
      mockRequest.body = {
        content: 123, // invalid type
      };

      await expect(
        thoughtController.create(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).rejects.toThrow(ZodError);
    });

    it("should propagate AppError from service", async () => {
      const requestBody = {
        content: "",
      };

      mockRequest.body = requestBody;
      const error = AppError.validationError("Content is required");
      vi.mocked(mockThoughtService.create).mockRejectedValue(error);

      await expect(
        thoughtController.create(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).rejects.toThrow(AppError);
    });
  });
});
