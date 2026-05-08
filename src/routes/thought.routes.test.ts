import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AppError, ErrorCode } from "@/common/errors/app-error";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    thought: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    thoughtVersion: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    thoughtDiff: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@prisma/client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@prisma/client")>();
  return {
    ...actual,
    PrismaClient: vi.fn(function PrismaClient() {
      return mockPrisma;
    }),
  };
});

import { build } from "@/server";

describe("Thought Routes Integration", () => {
  let app: ReturnType<typeof build>;

  beforeEach(async () => {
    vi.clearAllMocks();

    app = build({});
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  describe("POST /api/thoughts", () => {
    it("should create a thought successfully", async () => {
      const mockThought = {
        id: "thought-1",
        title: "Test Thought",
        createdAt: new Date(),
      };

      vi.mocked(mockPrisma.thought.create).mockResolvedValue(mockThought);

      const response = await app.inject({
        method: "POST",
        url: "/api/thoughts",
        payload: {
          title: "Test Thought",
          content: "Test content",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toMatchObject({
        id: expect.any(String),
        title: "Test Thought",
      });
    });

    it("should return 400 validation error when content is missing", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/thoughts",
        payload: {
          title: "Test Thought",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it("should coerce numeric JSON content via schema validation then create successfully", async () => {
      const mockThought = {
        id: "thought-1",
        title: "",
        createdAt: new Date(),
      };

      vi.mocked(mockPrisma.thought.create).mockResolvedValue(mockThought);

      const response = await app.inject({
        method: "POST",
        url: "/api/thoughts",
        payload: {
          content: 123,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockPrisma.thought.create).toHaveBeenCalled();
    });

    it("should return 400 validation error when content is empty", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/thoughts",
        payload: {
          content: "",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe("POST /api/thoughts/:thoughtId/versions", () => {
    it("should create a thought version successfully", async () => {
      const thoughtId = "thought-1";
      const mockThought = {
        id: thoughtId,
        title: "Test Thought",
        createdAt: new Date(),
      };

      const mockVersion = {
        id: "version-1",
        thoughtId,
        content: "New version content",
        createdAt: new Date(),
        aiSummary: null,
        aiTags: [],
        aiSummaryStatus: "NOT_APPLICABLE",
        aiSummaryErrorMessage: null,
      };

      vi.mocked(mockPrisma.thought.findUnique).mockResolvedValue(mockThought);
      vi.mocked(mockPrisma.thoughtVersion.findFirst).mockResolvedValue(null);
      vi.mocked(mockPrisma.thoughtVersion.create).mockResolvedValue(
        mockVersion
      );

      const response = await app.inject({
        method: "POST",
        url: `/api/thoughts/${thoughtId}/versions`,
        payload: {
          content: "New version content",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toMatchObject({
        id: expect.any(String),
        thoughtId,
        content: "New version content",
        aiSummaryStatus: "NOT_APPLICABLE",
      });
    });

    describe("POST /api/thoughts/:thoughtId/versions/:versionId/ai-summary", () => {
      const thoughtId = "thought-t1";

      const thoughtRow = {
        id: thoughtId,
        title: "T",
        createdAt: new Date(),
      };

      const completedVersionRow = {
        id: "version-done",
        thoughtId,
        content: "c",
        createdAt: new Date(),
        aiSummary: "done",
        aiTags: [] as string[],
        aiSummaryStatus: "COMPLETED",
        aiSummaryErrorMessage: null as string | null,
      };

      it("should return 200 with existing body when AI summary already completed", async () => {
        vi.mocked(mockPrisma.thought.findUnique).mockResolvedValue(thoughtRow);
        vi.mocked(mockPrisma.thoughtVersion.findUnique).mockResolvedValue(
          completedVersionRow
        );

        const response = await app.inject({
          method: "POST",
          url: `/api/thoughts/${thoughtId}/versions/${completedVersionRow.id}/ai-summary`,
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.data).toMatchObject({
          aiSummaryStatus: "COMPLETED",
          aiSummary: "done",
        });
        expect(mockPrisma.thoughtDiff.findMany).not.toHaveBeenCalled();
      });

      it("should return 422 when AI summary is not applicable", async () => {
        vi.mocked(mockPrisma.thought.findUnique).mockResolvedValue(thoughtRow);
        vi.mocked(mockPrisma.thoughtVersion.findUnique).mockResolvedValue({
          ...completedVersionRow,
          id: "v-na",
          aiSummaryStatus: "NOT_APPLICABLE",
          aiSummary: null,
        });

        const response = await app.inject({
          method: "POST",
          url: `/api/thoughts/${thoughtId}/versions/v-na/ai-summary`,
        });

        expect(response.statusCode).toBe(422);
        const body = JSON.parse(response.body);
        expect(body.error.code).toBe(ErrorCode.UNPROCESSABLE_ENTITY);
      });
    });

    it("should return 404 when thought does not exist (invalid thoughtId)", async () => {
      const nonExistentThoughtId = "non-existent-thought-id-12345";

      vi.mocked(mockPrisma.thought.findUnique).mockImplementation(
        (args: { where?: { id?: string } }) => {
          if (args?.where?.id === nonExistentThoughtId) {
            return Promise.resolve(null);
          }
          return Promise.resolve(null);
        }
      );

      const response = await app.inject({
        method: "POST",
        url: `/api/thoughts/${nonExistentThoughtId}/versions`,
        payload: {
          content: "New content",
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe("NOT_FOUND");
      expect(body.error.message).toBe("Thought not found");
    });

    it("should return 400 validation error when content is missing", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/thoughts/thought-1/versions",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });

    it("should return 404 when thought does not exist", async () => {
      const thoughtId = "non-existent-thought";

      vi.mocked(mockPrisma.thought.findUnique).mockResolvedValue(null);

      const response = await app.inject({
        method: "POST",
        url: `/api/thoughts/${thoughtId}/versions`,
        payload: {
          content: "New content",
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe(ErrorCode.NOT_FOUND);
      expect(body.error.message).toBe("Thought not found");
    });

    it("should return 400 validation error when content is empty", async () => {
      const thoughtId = "thought-1";
      const mockThought = {
        id: thoughtId,
        title: "Test Thought",
        createdAt: new Date(),
      };

      vi.mocked(mockPrisma.thought.findUnique).mockResolvedValue(mockThought);

      const response = await app.inject({
        method: "POST",
        url: `/api/thoughts/${thoughtId}/versions`,
        payload: {
          content: "",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
    });
  });

  describe("Error handling", () => {
    it("should handle internal server errors", async () => {
      vi.mocked(mockPrisma.thought.create).mockRejectedValue(
        new Error("Database error")
      );

      const response = await app.inject({
        method: "POST",
        url: "/api/thoughts",
        payload: {
          content: "Test content",
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
    });
  });
});
