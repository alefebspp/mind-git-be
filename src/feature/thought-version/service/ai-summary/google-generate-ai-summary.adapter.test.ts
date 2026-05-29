import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { ErrorCode } from "@/common/errors/app-error";
import { promises as fs } from "fs";

const {
  mockGenerateContent,
  mockGetGenerativeModel,
  mockGoogleGenerativeAI,
} = vi.hoisted(() => {
  const mockGenerateContent = vi.fn();
  const mockGetGenerativeModel = vi.fn(() => ({
    generateContent: mockGenerateContent,
  }));
  const mockGoogleGenerativeAI = vi.fn(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  }));
  return { mockGenerateContent, mockGetGenerativeModel, mockGoogleGenerativeAI };
});

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: mockGoogleGenerativeAI,
}));

vi.mock("fs", () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

import { createGoogleGenerateAiSummary } from "@/feature/thought-version/service/ai-summary/google-generate-ai-summary.adapter";

describe("createGoogleGenerateAiSummary", () => {
  const originalEnv = process.env.GOOGLE_API_KEY;
  const generateAiSummary = createGoogleGenerateAiSummary();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateContent.mockReset();
    mockGetGenerativeModel.mockClear();
    mockGoogleGenerativeAI.mockClear();
  });

  afterEach(() => {
    process.env.GOOGLE_API_KEY = originalEnv;
  });

  it("throws when Google API key is not configured", async () => {
    delete process.env.GOOGLE_API_KEY;

    await expect(
      generateAiSummary("old", "new", ["word1"], ["word2"], {})
    ).rejects.toMatchObject({
      code: ErrorCode.INTERNAL_ERROR,
      message: "Google API key is not configured",
    });
  });

  it("generates AI summary successfully", async () => {
    process.env.GOOGLE_API_KEY = "test-key";
    vi.mocked(fs.readFile).mockResolvedValue(
      "Template {oldExcerpt} {newExcerpt}"
    );

    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => "Generated summary",
      },
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
    expect(mockGoogleGenerativeAI).toHaveBeenCalledWith("test-key");
    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gemini-2.0-flash-lite" })
    );
    expect(mockGenerateContent).toHaveBeenCalled();
  });

  it("throws when Gemini returns empty summary", async () => {
    process.env.GOOGLE_API_KEY = "test-key";
    vi.mocked(fs.readFile).mockResolvedValue("Template");

    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => "   ",
      },
    });

    await expect(
      generateAiSummary("old", "new", ["word1"], ["word2"], {})
    ).rejects.toMatchObject({
      code: ErrorCode.INTERNAL_ERROR,
      message: "Failed to generate AI summary",
    });
  });

  it("throws when Gemini API call fails", async () => {
    process.env.GOOGLE_API_KEY = "test-key";
    vi.mocked(fs.readFile).mockResolvedValue("Template");
    mockGenerateContent.mockRejectedValue(new Error("API Error"));

    await expect(
      generateAiSummary("old", "new", ["word1"], ["word2"], {})
    ).rejects.toMatchObject({
      code: ErrorCode.INTERNAL_ERROR,
    });
  });
});
