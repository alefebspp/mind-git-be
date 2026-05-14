import IORedis from "ioredis";

export function createRedisConnection(): IORedis {
  const url = process.env.REDIS_URL;
  if (!url || url.trim() === "") {
    throw new Error("REDIS_URL is required");
  }
  return new IORedis(url, {
    maxRetriesPerRequest: null,
  });
}
