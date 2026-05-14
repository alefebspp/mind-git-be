import { describe, it, expect, beforeEach, vi } from "vitest";
import { UnrecoverableError } from "bullmq";
import {
  markAiSummaryFailedAfterRetries,
  processAiSummaryJob,
} from "@/infrastructure/bullmq/ai-summary-job.processor";
import { ThoughtVersionRepository } from "@/feature/thought-version/repository/thought-version.repository";
import { ThoughtDiffRepository } from "@/feature/thought-diff/repository/thought-diff.repository";
import {
  AiSummaryStatus,
  ThoughtVersion,
} from "@/feature/thought-version/thought-version.model";
import { ThoughtDiff } from "@/feature/thought-diff/thought-diff.model";

describe("processAiSummaryJob", () => {
  let mockVersionRepo: ThoughtVersionRepository;
  let mockDiffRepo: ThoughtDiffRepository;
  let mockGenerate: (
    oldContent: string,
    newContent: string,
    addedWords: string[],
    removedWords: string[],
    metrics: Record<string, unknown>
  ) => Promise<string>;

  const diff: ThoughtDiff = {
    id: "diff-1",
    fromVersionId: "v-from",
    toVersionId: "v-target",
    addedWords: ["a"],
    removedWords: ["b"],
    metrics: {},
    createdAt: new Date(),
  };

  const payload = {
    thoughtId: "t-1",
    thoughtVersionId: "v-target",
    diffId: "diff-1",
    intent: "auto" as const,
  };

  const fromV: ThoughtVersion = {
    id: "v-from",
    thoughtId: "t-1",
    content: "old",
    createdAt: new Date(),
    aiSummary: null,
    aiTags: [],
    aiSummaryStatus: AiSummaryStatus.COMPLETED,
    aiSummaryErrorMessage: null,
  };

  const pendingTarget: ThoughtVersion = {
    id: "v-target",
    thoughtId: "t-1",
    content: "new",
    createdAt: new Date(),
    aiSummary: null,
    aiTags: [],
    aiSummaryStatus: AiSummaryStatus.PENDING,
    aiSummaryErrorMessage: null,
  };

  beforeEach(() => {
    mockGenerate = vi.fn().mockResolvedValue("summary text");
    mockVersionRepo = {
      findById: vi.fn(),
      updateIfAiSummaryStatusIn: vi.fn(),
    } as unknown as ThoughtVersionRepository;
    mockDiffRepo = {
      findById: vi.fn(),
    } as unknown as ThoughtDiffRepository;
  });

  it("returns without calling AI when version is already COMPLETED", async () => {
    vi.mocked(mockVersionRepo.findById).mockResolvedValue({
      ...pendingTarget,
      aiSummaryStatus: AiSummaryStatus.COMPLETED,
      aiSummary: "done",
    });

    await processAiSummaryJob(payload, {
      thoughtVersionRepository: mockVersionRepo,
      thoughtDiffRepository: mockDiffRepo,
      generateAiSummary: mockGenerate,
    });

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockDiffRepo.findById).not.toHaveBeenCalled();
  });

  it("marks COMPLETED on success", async () => {
    const processing: ThoughtVersion = {
      ...pendingTarget,
      aiSummaryStatus: AiSummaryStatus.PROCESSING,
    };

    vi.mocked(mockVersionRepo.findById).mockImplementation(async (id) => {
      if (id === "v-target") {
        return pendingTarget;
      }
      if (id === "v-from") {
        return fromV;
      }
      return null;
    });
    vi.mocked(mockDiffRepo.findById).mockResolvedValue(diff);
    vi.mocked(mockVersionRepo.updateIfAiSummaryStatusIn)
      .mockResolvedValueOnce(processing)
      .mockResolvedValueOnce({
        ...processing,
        aiSummary: "summary text",
        aiSummaryStatus: AiSummaryStatus.COMPLETED,
      });

    await processAiSummaryJob(payload, {
      thoughtVersionRepository: mockVersionRepo,
      thoughtDiffRepository: mockDiffRepo,
      generateAiSummary: mockGenerate,
    });

    expect(mockGenerate).toHaveBeenCalled();
    expect(mockVersionRepo.updateIfAiSummaryStatusIn).toHaveBeenCalledWith(
      "v-target",
      [AiSummaryStatus.PROCESSING],
      expect.objectContaining({
        aiSummaryStatus: AiSummaryStatus.COMPLETED,
        aiSummary: "summary text",
      })
    );
  });

  it("reverts to PENDING on transient failure", async () => {
    const processing: ThoughtVersion = {
      ...pendingTarget,
      aiSummaryStatus: AiSummaryStatus.PROCESSING,
    };

    vi.mocked(mockVersionRepo.findById).mockImplementation(async (id) => {
      if (id === "v-target") {
        return pendingTarget;
      }
      if (id === "v-from") {
        return fromV;
      }
      return null;
    });
    vi.mocked(mockDiffRepo.findById).mockResolvedValue(diff);
    vi.mocked(mockVersionRepo.updateIfAiSummaryStatusIn)
      .mockResolvedValueOnce(processing)
      .mockResolvedValueOnce({ ...pendingTarget });
    vi.mocked(mockGenerate).mockRejectedValue(new Error("rate limit"));

    await expect(
      processAiSummaryJob(payload, {
        thoughtVersionRepository: mockVersionRepo,
        thoughtDiffRepository: mockDiffRepo,
        generateAiSummary: mockGenerate,
      })
    ).rejects.toThrow("rate limit");

    expect(mockVersionRepo.updateIfAiSummaryStatusIn).toHaveBeenLastCalledWith(
      "v-target",
      [AiSummaryStatus.PROCESSING],
      expect.objectContaining({
        aiSummaryStatus: AiSummaryStatus.PENDING,
      })
    );
  });

  it("throws UnrecoverableError for NOT_APPLICABLE", async () => {
    vi.mocked(mockVersionRepo.findById).mockResolvedValue({
      ...pendingTarget,
      aiSummaryStatus: AiSummaryStatus.NOT_APPLICABLE,
    });

    await expect(
      processAiSummaryJob(payload, {
        thoughtVersionRepository: mockVersionRepo,
        thoughtDiffRepository: mockDiffRepo,
        generateAiSummary: mockGenerate,
      })
    ).rejects.toBeInstanceOf(UnrecoverableError);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});

describe("markAiSummaryFailedAfterRetries", () => {
  it("promotes PENDING to FAILED", async () => {
    const mockVersionRepo = {
      updateIfAiSummaryStatusIn: vi.fn().mockResolvedValue({}),
    } as unknown as ThoughtVersionRepository;

    await markAiSummaryFailedAfterRetries(
      {
        thoughtVersionRepository: mockVersionRepo,
        thoughtDiffRepository: {} as ThoughtDiffRepository,
        generateAiSummary: vi.fn(),
      },
      {
        thoughtId: "t-1",
        thoughtVersionId: "v-1",
        diffId: "d-1",
        intent: "auto",
      },
      "exhausted"
    );

    expect(mockVersionRepo.updateIfAiSummaryStatusIn).toHaveBeenCalledWith(
      "v-1",
      [AiSummaryStatus.PENDING],
      expect.objectContaining({
        aiSummaryStatus: AiSummaryStatus.FAILED,
        aiSummaryErrorMessage: "exhausted",
      })
    );
  });
});
