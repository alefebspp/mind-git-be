import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { AppError, ErrorCode } from "@/common/errors/app-error";
import { promises as fs } from "fs";

vi.mock("openai", () => {
  const mockCreate = vi.fn();

  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));

  (MockOpenAI as unknown as { __mockCreate: typeof mockCreate }).__mockCreate =
    mockCreate;

  return {
    default: MockOpenAI,
  };
});

vi.mock("fs", () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

import { createOpenAiGenerateAiSummary } from "@/feature/thought-version/service/ai-summary/openai-generate-ai-summary.adapter";
import OpenAI from "openai";

function getMockCreate() {
  return (OpenAI as unknown as { __mockCreate: ReturnType<typeof vi.fn> })
    .__mockCreate;
}

describe("createOpenAiGenerateAiSummary", () => {
  const originalEnv = process.env.OPENAI_API_KEY;
  const generateAiSummary = createOpenAiGenerateAiSummary();

  beforeEach(() => {
    vi.clearAllMocks();
    getMockCreate()?.mockClear();
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalEnv;
    vi.clearAllMocks();
  });

  it("throws when OpenAI API key is not configured", async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(
      generateAiSummary("old", "new", ["word1"], ["word2"], {})
    ).rejects.toMatchObject({
      code: ErrorCode.INTERNAL_ERROR,
      message: "OpenAI API key is not configured",
    });
  });

  it("generates AI summary successfully", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    vi.mocked(fs.readFile).mockResolvedValue(
      "Template {oldExcerpt} {newExcerpt}"
    );

    getMockCreate()?.mockResolvedValue({
      choices: [{ message: { content: "Generated summary" } }],
    });

    const result = await generateAiSummary(
      "old content",
      "new content",
      ["added"],
      ["removed"],
      { count: 1 }
    );

    expect(result).toBe("Generated summary");
    expect(fs.readFile).toHaveBeenCalled();
    expect(getMockCreate()).toHaveBeenCalled();
  });

  it("throws when OpenAI returns empty summary", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.mocked(fs.readFile).mockResolvedValue("Template");

    getMockCreate()?.mockResolvedValue({
      choices: [{ message: { content: "" } }],
    });

    await expect(
      generateAiSummary("old", "new", ["word1"], ["word2"], {})
    ).rejects.toMatchObject({
      code: ErrorCode.INTERNAL_ERROR,
      message: "Failed to generate AI summary",
    });
  });

  it("throws when OpenAI API call fails", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    vi.mocked(fs.readFile).mockResolvedValue("Template");
    getMockCreate()?.mockRejectedValue(new Error("API Error"));

    await expect(
      generateAiSummary("old", "new", ["word1"], ["word2"], {})
    ).rejects.toMatchObject({
      code: ErrorCode.INTERNAL_ERROR,
    });
  });
});
