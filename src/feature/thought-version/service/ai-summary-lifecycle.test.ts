import { describe, it, expect, beforeEach, vi } from "vitest";
import { UnrecoverableError } from "bullmq";
import { ThoughtDiff } from "@/feature/thought-diff/thought-diff.model";
import { ThoughtDiffRepository } from "@/feature/thought-diff/repository/thought-diff.repository";
import {
  AiSummaryLifecycleCode,
  AiSummaryLifecycleError,
} from "@/feature/thought-version/service/ai-summary-lifecycle.errors";
import {
  markAiSummaryTerminalFailure,
  prepareManualAiSummaryRetry,
  processAiSummaryJobLifecycle,
  toWorkerJobError,
} from "@/feature/thought-version/service/ai-summary-lifecycle";
import {
  AiSummaryStatus,
  ThoughtVersion,
} from "@/feature/thought-version/thought-version.model";
import { ThoughtVersionRepository } from "@/feature/thought-version/repository/thought-version.repository";

function version(
  overrides: Partial<ThoughtVersion> & Pick<ThoughtVersion, "id" | "thoughtId">
): ThoughtVersion {
  return {
    content: "content",
    createdAt: new Date(),
    aiSummary: null,
    aiTags: [],
    aiSummaryStatus: AiSummaryStatus.PENDING,
    aiSummaryErrorMessage: null,
    ...overrides,
  };
}

describe("prepareManualAiSummaryRetry", () => {
  let mockVersionRepo: ThoughtVersionRepository;
  let mockDiffRepo: ThoughtDiffRepository;

  const thoughtId = "t-1";
  const diff: ThoughtDiff = {
    id: "diff-1",
    fromVersionId: "v-from",
    toVersionId: "v-target",
    addedWords: [],
    removedWords: [],
    metrics: {},
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockVersionRepo = {
      findById: vi.fn(),
      update: vi.fn(),
    } as unknown as ThoughtVersionRepository;
    mockDiffRepo = {
      findByToVersionId: vi.fn(),
    } as unknown as ThoughtDiffRepository;
  });

  const rejectCases: {
    status: AiSummaryStatus;
    code: AiSummaryLifecycleCode;
  }[] = [
    {
      status: AiSummaryStatus.NOT_APPLICABLE,
      code: AiSummaryLifecycleCode.NOT_APPLICABLE,
    },
    {
      status: AiSummaryStatus.PROCESSING,
      code: AiSummaryLifecycleCode.ALREADY_PROCESSING,
    },
  ];

  it.each(rejectCases)(
    "rejects when status is $status",
    async ({ status, code }) => {
      const v = version({
        id: "v-target",
        thoughtId,
        aiSummaryStatus: status,
      });

      await expect(
        prepareManualAiSummaryRetry({
          thoughtId,
          version: v,
          thoughtVersionRepository: mockVersionRepo,
          thoughtDiffRepository: mockDiffRepo,
        })
      ).rejects.toMatchObject({ code });

      expect(mockDiffRepo.findByToVersionId).not.toHaveBeenCalled();
    }
  );

  it("returns noop when COMPLETED", async () => {
    const v = version({
      id: "v-done",
      thoughtId,
      aiSummaryStatus: AiSummaryStatus.COMPLETED,
      aiSummary: "done",
    });

    const result = await prepareManualAiSummaryRetry({
      thoughtId,
      version: v,
      thoughtVersionRepository: mockVersionRepo,
      thoughtDiffRepository: mockDiffRepo,
    });

    expect(result).toEqual({ kind: "noop", version: v });
  });

  it("rejects when no diff exists", async () => {
    vi.mocked(mockDiffRepo.findByToVersionId).mockResolvedValue([]);

    await expect(
      prepareManualAiSummaryRetry({
        thoughtId,
        version: version({
          id: "v-target",
          thoughtId,
          aiSummaryStatus: AiSummaryStatus.FAILED,
        }),
        thoughtVersionRepository: mockVersionRepo,
        thoughtDiffRepository: mockDiffRepo,
      })
    ).rejects.toMatchObject({ code: AiSummaryLifecycleCode.NO_DIFF });
  });

  it("rejects when fromVersion is missing", async () => {
    vi.mocked(mockDiffRepo.findByToVersionId).mockResolvedValue([diff]);
    vi.mocked(mockVersionRepo.findById).mockResolvedValue(null);

    await expect(
      prepareManualAiSummaryRetry({
        thoughtId,
        version: version({ id: "v-target", thoughtId }),
        thoughtVersionRepository: mockVersionRepo,
        thoughtDiffRepository: mockDiffRepo,
      })
    ).rejects.toMatchObject({
      code: AiSummaryLifecycleCode.MISSING_FROM_VERSION,
    });
  });

  it("normalizes FAILED to PENDING and returns manual job payload", async () => {
    const failed = version({
      id: "v-target",
      thoughtId,
      aiSummaryStatus: AiSummaryStatus.FAILED,
    });
    const pending = version({
      ...failed,
      aiSummaryStatus: AiSummaryStatus.PENDING,
      aiSummaryErrorMessage: null,
    });

    vi.mocked(mockDiffRepo.findByToVersionId).mockResolvedValue([diff]);
    vi.mocked(mockVersionRepo.findById).mockResolvedValue(
      version({ id: "v-from", thoughtId, content: "old" })
    );
    vi.mocked(mockVersionRepo.update).mockResolvedValue(pending);

    const result = await prepareManualAiSummaryRetry({
      thoughtId,
      version: failed,
      thoughtVersionRepository: mockVersionRepo,
      thoughtDiffRepository: mockDiffRepo,
    });

    expect(mockVersionRepo.update).toHaveBeenCalledWith("v-target", {
      aiSummaryStatus: AiSummaryStatus.PENDING,
      aiSummaryErrorMessage: null,
    });
    expect(result).toEqual({
      kind: "enqueue",
      version: pending,
      job: {
        thoughtId,
        thoughtVersionId: "v-target",
        diffId: "diff-1",
        intent: "manual",
      },
    });
  });

  it("enqueues without update when already PENDING", async () => {
    const pending = version({ id: "v-wait", thoughtId });

    vi.mocked(mockDiffRepo.findByToVersionId).mockResolvedValue([diff]);
    vi.mocked(mockVersionRepo.findById).mockResolvedValue(
      version({ id: "v-from", thoughtId })
    );

    const result = await prepareManualAiSummaryRetry({
      thoughtId,
      version: pending,
      thoughtVersionRepository: mockVersionRepo,
      thoughtDiffRepository: mockDiffRepo,
    });

    expect(mockVersionRepo.update).not.toHaveBeenCalled();
    expect(result.kind).toBe("enqueue");
  });
});

describe("processAiSummaryJobLifecycle", () => {
  let mockVersionRepo: ThoughtVersionRepository;
  let mockDiffRepo: ThoughtDiffRepository;
  let mockGenerate: ReturnType<typeof vi.fn>;

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

  const pendingTarget = version({ id: "v-target", thoughtId: "t-1", content: "new" });
  const fromV = version({
    id: "v-from",
    thoughtId: "t-1",
    content: "old",
    aiSummaryStatus: AiSummaryStatus.COMPLETED,
  });

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

    await processAiSummaryJobLifecycle(payload, {
      thoughtVersionRepository: mockVersionRepo,
      thoughtDiffRepository: mockDiffRepo,
      generateAiSummary: mockGenerate,
    });

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockDiffRepo.findById).not.toHaveBeenCalled();
  });

  it.each([
    AiSummaryStatus.NOT_APPLICABLE,
    AiSummaryStatus.PROCESSING,
  ])("rejects permanent state %s", async (status) => {
    vi.mocked(mockVersionRepo.findById).mockResolvedValue({
      ...pendingTarget,
      aiSummaryStatus: status,
    });

    await expect(
      processAiSummaryJobLifecycle(payload, {
        thoughtVersionRepository: mockVersionRepo,
        thoughtDiffRepository: mockDiffRepo,
        generateAiSummary: mockGenerate,
      })
    ).rejects.toBeInstanceOf(AiSummaryLifecycleError);

    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("marks COMPLETED on success", async () => {
    const processing = version({
      ...pendingTarget,
      aiSummaryStatus: AiSummaryStatus.PROCESSING,
    });

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

    await processAiSummaryJobLifecycle(payload, {
      thoughtVersionRepository: mockVersionRepo,
      thoughtDiffRepository: mockDiffRepo,
      generateAiSummary: mockGenerate,
    });

    expect(mockGenerate).toHaveBeenCalled();
    expect(mockVersionRepo.updateIfAiSummaryStatusIn).toHaveBeenLastCalledWith(
      "v-target",
      [AiSummaryStatus.PROCESSING],
      expect.objectContaining({
        aiSummaryStatus: AiSummaryStatus.COMPLETED,
      })
    );
  });

  it("reverts to PENDING on transient failure", async () => {
    const processing = version({
      ...pendingTarget,
      aiSummaryStatus: AiSummaryStatus.PROCESSING,
    });

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
      .mockResolvedValueOnce(pendingTarget);
    mockGenerate.mockRejectedValue(new Error("rate limit"));

    await expect(
      processAiSummaryJobLifecycle(payload, {
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
});

describe("toWorkerJobError", () => {
  it("maps PROCESSING guard to UnrecoverableError", () => {
    const mapped = toWorkerJobError(
      new AiSummaryLifecycleError(AiSummaryLifecycleCode.ALREADY_PROCESSING)
    );
    expect(mapped).toBeInstanceOf(UnrecoverableError);
  });

  it("maps claim failure to retryable Error", () => {
    const mapped = toWorkerJobError(
      new AiSummaryLifecycleError(AiSummaryLifecycleCode.CLAIM_FAILED)
    );
    expect(mapped).toBeInstanceOf(Error);
    expect(mapped).not.toBeInstanceOf(UnrecoverableError);
  });
});

describe("markAiSummaryTerminalFailure", () => {
  it("promotes PENDING or PROCESSING to FAILED", async () => {
    const mockVersionRepo = {
      updateIfAiSummaryStatusIn: vi.fn().mockResolvedValue({}),
    } as unknown as ThoughtVersionRepository;

    await markAiSummaryTerminalFailure(
      { thoughtVersionRepository: mockVersionRepo },
      { thoughtVersionId: "v-1" },
      "exhausted"
    );

    expect(mockVersionRepo.updateIfAiSummaryStatusIn).toHaveBeenCalledWith(
      "v-1",
      [AiSummaryStatus.PENDING, AiSummaryStatus.PROCESSING],
      expect.objectContaining({
        aiSummaryStatus: AiSummaryStatus.FAILED,
        aiSummaryErrorMessage: "exhausted",
      })
    );
  });
});
