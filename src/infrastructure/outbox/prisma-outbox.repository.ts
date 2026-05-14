import { OutboxEventStatus, PrismaClient } from "@prisma/client";
import type {
  OutboxRepository,
  PendingOutboxEvent,
} from "@/infrastructure/outbox/outbox.repository";

const DISPATCH_BACKOFF_MS_BASE = 5000;
const MAX_OUTBOX_DISPATCH_ATTEMPTS = 20;

export class PrismaOutboxRepository implements OutboxRepository {
  constructor(private prisma: PrismaClient) {}

  async findPublishableBatch(limit: number): Promise<PendingOutboxEvent[]> {
    const now = new Date();
    const rows = await this.prisma.outboxEvent.findMany({
      where: {
        status: OutboxEventStatus.PENDING,
        attempts: { lt: MAX_OUTBOX_DISPATCH_ATTEMPTS },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    return rows.map((r) => ({
      id: r.id,
      eventType: r.eventType,
      aggregateId: r.aggregateId,
      payload: r.payload as Record<string, unknown>,
    }));
  }

  async markPublished(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: OutboxEventStatus.PUBLISHED,
        publishedAt: new Date(),
        lastError: null,
      },
    });
  }

  async recordPublishFailure(id: string, errorMessage: string): Promise<void> {
    const row = await this.prisma.outboxEvent.findUnique({ where: { id } });
    if (!row) {
      return;
    }

    const nextAttempts = row.attempts + 1;
    const nextDelay = Math.min(
      DISPATCH_BACKOFF_MS_BASE * 2 ** Math.max(0, nextAttempts - 1),
      60 * 60 * 1000
    );
    const nextAttemptAt = new Date(Date.now() + nextDelay);

    await this.prisma.outboxEvent.update({
      where: { id },
      data: {
        attempts: nextAttempts,
        lastError: errorMessage.slice(0, 2000),
        nextAttemptAt,
        ...(nextAttempts >= MAX_OUTBOX_DISPATCH_ATTEMPTS && {
          status: OutboxEventStatus.FAILED,
        }),
      },
    });
  }
}
