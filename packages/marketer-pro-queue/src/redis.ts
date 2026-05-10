import { Redis, type RedisOptions } from "ioredis";

export const DEFAULT_REDIS_URL = "redis://127.0.0.1:6379";

/**
 * Redis connection suitable for BullMQ.
 * After applying `overrides`, these options are always set and cannot be overridden:
 * `maxRetriesPerRequest: null`, `enableReadyCheck: true`, `lazyConnect: false`.
 * @see https://docs.bullmq.io/guide/connections
 */
export function createRedisConnection(
  url = process.env.REDIS_URL ?? DEFAULT_REDIS_URL,
  overrides: Omit<
    RedisOptions,
    "maxRetriesPerRequest" | "enableReadyCheck" | "lazyConnect"
  > = {},
): Redis {
  const connection = new Redis(url, {
    ...overrides,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  connection.on("error", (err: Error) => {
    console.error("[marketer-pro-queue] Redis connection error:", err.message);
  });

  return connection;
}
