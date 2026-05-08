import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AppError, ErrorCode } from "@/common/errors/app-error";

// Mock Prisma Client before importing anything
const mockPrisma = {
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
};

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(() => mockPrisma),
}));

// Import after mocks
import { build } from "@/server";

describe("Thought Routes Integration", () => {
  let app: ReturnType<typeof build>;

  beforeEach(async () => {
    // Reset all mocks before each test
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
      expect(body.error.details).toBeDefined();
    });

    it("should return 400 validation error when content is not a string", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/thoughts",
        payload: {
          content: 123,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
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
      });
    });

    it("should return 404 when thought does not exist (invalid thoughtId)", async () => {
      // Test with a non-existent thoughtId - this should return 404
      const nonExistentThoughtId = "non-existent-thought-id-12345";

      // Explicitly set the mock to return null for this thoughtId
      vi.mocked(mockPrisma.thought.findUnique).mockImplementation(
        (args: any) => {
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

      // The service should check if thought exists and return 404 (not found)
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
