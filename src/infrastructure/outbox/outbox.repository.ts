import type { OutboxEventType } from "@prisma/client";

export type PendingOutboxEvent = {
  id: string;
  eventType: OutboxEventType;
  aggregateId: string;
  payload: Record<string, unknown>;
};

export interface OutboxRepository {
  findPublishableBatch(limit: number): Promise<PendingOutboxEvent[]>;
  markPublished(id: string): Promise<void>;
  recordPublishFailure(id: string, errorMessage: string): Promise<void>;
}
