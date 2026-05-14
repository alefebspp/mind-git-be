import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaThoughtVersionRepository } from "@/feature/thought-version/repository/prisma-thought-version.repository";
import { PrismaThoughtDiffRepository } from "@/feature/thought-diff/repository/prisma-thought-diff.repository";
import { generateAiSummary } from "@/feature/thought-version/service/thought-version-ai.service";
import { createRedisConnection } from "@/infrastructure/bullmq/redis-connection";
import { createAiSummaryQueue } from "@/infrastructure/bullmq/ai-summary.queue";
import { createAiSummaryWorkerRuntime } from "@/infrastructure/bullmq/ai-summary.worker.runtime";
import { PrismaOutboxRepository } from "@/infrastructure/outbox/prisma-outbox.repository";
import { OutboxDispatcher } from "@/infrastructure/outbox/outbox-dispatcher";

const prisma = new PrismaClient();
const redis = createRedisConnection();
const queue = createAiSummaryQueue(redis);

const thoughtVersionRepository = new PrismaThoughtVersionRepository(prisma);
const thoughtDiffRepository = new PrismaThoughtDiffRepository(prisma);

const workerRuntime = createAiSummaryWorkerRuntime(redis, {
  thoughtVersionRepository,
  thoughtDiffRepository,
  generateAiSummary,
});

const outboxRepository = new PrismaOutboxRepository(prisma);
const dispatcher = new OutboxDispatcher(outboxRepository, queue, {
  pollIntervalMs: Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 2000),
});

dispatcher.start();

async function shutdown(): Promise<void> {
  dispatcher.stop();
  await workerRuntime.shutdown();
  await queue.close();
  await redis.quit();
  await prisma.$disconnect();
}

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});
process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});

console.log(
  JSON.stringify({
    msg: "ai_summary_worker_started",
    queue: "ai-summary",
    outboxPollMs: Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 2000),
  })
);
