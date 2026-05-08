import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { AppError, ErrorCode } from "@/common/errors/app-error";
import { promises as fs } from "fs";

// Mock OpenAI - create everything inside the factory without external references
vi.mock("openai", () => {
  const mockCreate = vi.fn();

  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));

  // Store the mock function on the constructor so we can access it later
  (MockOpenAI as any).__mockCreate = mockCreate;

  return {
    default: MockOpenAI,
  };
});

vi.mock("fs", () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

// Import after mocks
import { generateAiSummary } from "@/feature/thought-version/service/thought-version-ai.service";
import OpenAI from "openai";

// Helper to get the mock create function
function getMockCreate() {
  return (OpenAI as any).__mockCreate as ReturnType<typeof vi.fn>;
}

describe("generateAiSummary", () => {
  const originalEnv = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    const mockCreate = getMockCreate();
    if (mockCreate) {
      mockCreate.mockClear();
    }
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalEnv;
    vi.clearAllMocks();
    const mockCreate = getMockCreate();
    if (mockCreate) {
      mockCreate.mockClear();
    }
  });

  it("should throw error when OpenAI API key is not configured", async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(
      generateAiSummary("old", "new", ["word1"], ["word2"], {})
    ).rejects.toThrow(AppError);
    await expect(
      generateAiSummary("old", "new", ["word1"], ["word2"], {})
    ).rejects.toMatchObject({
      code: ErrorCode.INTERNAL_ERROR,
      message: "OpenAI API key is not configured",
    });
  });

  it("should generate AI summary successfully", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const mockPromptTemplate = "Template with {oldExcerpt} {newExcerpt}";
    vi.mocked(fs.readFile).mockResolvedValue(mockPromptTemplate);

    const mockResponse = {
      choices: [
        {
          message: {
            content: "Generated summary",
          },
        },
      ],
    };

    const mockCreate = getMockCreate();
    if (mockCreate) {
      mockCreate.mockResolvedValue(mockResponse);
    }

    const result = await generateAiSummary(
      "old content",
      "new content",
      ["added"],
      ["removed"],
      { count: 1 }
    );

    expect(result).toBe("Generated summary");
    expect(fs.readFile).toHaveBeenCalled();
    if (mockCreate) {
      expect(mockCreate).toHaveBeenCalled();
    }
  });

  it("should throw error when OpenAI returns empty summary", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const mockPromptTemplate = "Template";
    vi.mocked(fs.readFile).mockResolvedValue(mockPromptTemplate);

    const mockResponse = {
      choices: [
        {
          message: {
            content: "",
          },
        },
      ],
    };

    const mockCreate = getMockCreate();
    if (mockCreate) {
      mockCreate.mockResolvedValue(mockResponse);
    }

    await expect(
      generateAiSummary("old", "new", ["word1"], ["word2"], {})
    ).rejects.toThrow(AppError);

    const error = await generateAiSummary(
      "old",
      "new",
      ["word1"],
      ["word2"],
      {}
    ).catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ErrorCode.INTERNAL_ERROR);
    expect((error as AppError).message).toBe("Failed to generate AI summary");
  });

  it("should throw error when OpenAI API call fails", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const mockPromptTemplate = "Template";
    vi.mocked(fs.readFile).mockResolvedValue(mockPromptTemplate);

    const mockCreate = getMockCreate();
    if (mockCreate) {
      mockCreate.mockRejectedValue(new Error("API Error"));
    }

    await expect(
      generateAiSummary("old", "new", ["word1"], ["word2"], {})
    ).rejects.toThrow(AppError);
    await expect(
      generateAiSummary("old", "new", ["word1"], ["word2"], {})
    ).rejects.toMatchObject({
      code: ErrorCode.INTERNAL_ERROR,
    });
  });
});
