import { describe, it, expect, beforeEach, vi } from "vitest";
import { OutboxDispatcher } from "@/infrastructure/outbox/outbox-dispatcher";
import type { OutboxRepository } from "@/infrastructure/outbox/outbox.repository";
import type { AiSummaryJobData } from "@/infrastructure/bullmq/ai-summary-job.types";

describe("OutboxDispatcher", () => {
  let mockOutbox: OutboxRepository;
  let mockQueue: {
    add: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockOutbox = {
      findPublishableBatch: vi.fn(),
      markPublished: vi.fn(),
      recordPublishFailure: vi.fn(),
    };

    mockQueue = {
      add: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("publishes jobs with deterministic jobId and marks outbox PUBLISHED", async () => {
    const payload: AiSummaryJobData = {
      thoughtId: "t-1",
      thoughtVersionId: "v-9",
      diffId: "d-1",
      intent: "auto",
    };

    vi.mocked(mockOutbox.findPublishableBatch).mockResolvedValue([
      {
        id: "ob-1",
        eventType: "AI_SUMMARY_REQUESTED" as never,
        aggregateId: "v-9",
        payload: payload as unknown as Record<string, unknown>,
      },
    ]);

    const dispatcher = new OutboxDispatcher(
      mockOutbox,
      mockQueue as never,
      { pollIntervalMs: 50_000, batchSize: 10 }
    );

    await dispatcher.tick();

    expect(mockQueue.add).toHaveBeenCalledWith(
      "generate",
      payload,
      expect.objectContaining({
        jobId: "ai-summary:v-9",
      })
    );
    expect(mockOutbox.markPublished).toHaveBeenCalledWith("ob-1");
    expect(mockOutbox.recordPublishFailure).not.toHaveBeenCalled();
  });

  it("records failure when queue.add throws", async () => {
    vi.mocked(mockOutbox.findPublishableBatch).mockResolvedValue([
      {
        id: "ob-2",
        eventType: "AI_SUMMARY_REQUESTED" as never,
        aggregateId: "v-1",
        payload: {
          thoughtId: "t-1",
          thoughtVersionId: "v-1",
          diffId: "d-1",
          intent: "auto",
        },
      },
    ]);
    mockQueue.add.mockRejectedValue(new Error("redis down"));

    const dispatcher = new OutboxDispatcher(
      mockOutbox,
      mockQueue as never,
      { pollIntervalMs: 50_000 }
    );

    await dispatcher.tick();

    expect(mockOutbox.markPublished).not.toHaveBeenCalled();
    expect(mockOutbox.recordPublishFailure).toHaveBeenCalledWith(
      "ob-2",
      "redis down"
    );
  });
});
