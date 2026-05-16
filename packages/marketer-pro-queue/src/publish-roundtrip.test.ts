/**
 * Real-Redis roundtrip: enqueue → worker processes → result returned.
 *
 * After a successful PING, assigns `process.env.REDIS_URL` to that broker so
 * callers using the default `createRedisConnection()` URL see the same verified
 * endpoint. Restores the prior env when the suite finishes if it was changed.
 *
 * Uses `REDIS_URL` (or the package default) when that broker responds to PING.
 * If not (no local Redis), starts an embedded server via `redis-memory-server`
 * so CI and laptops without
 * Docker still exercise BullMQ. Opt out of the fallback with
 * `MARKETER_SKIP_EMBEDDED_REDIS=1` to keep the old skip-only behaviour.
 *
 * Run alone:
 *   npx vitest run packages/marketer-pro-queue/src/publish-roundtrip.test.ts
 */

import { Queue, type Job } from "bullmq";
import { Redis } from "ioredis";
import RedisMemoryServer from "redis-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type PublishJobPayload,
  type PublishJobResult,
} from "./publish-job.js";
import { createPublishQueue, enqueuePublishJob } from "./publish-queue.js";
import { createPublishWorker } from "./publish-worker.js";
import { createRedisConnection, DEFAULT_REDIS_URL } from "./redis.js";

const PING_TIMEOUT_MS = 750;
/** Unique queue name per run keeps parallel CI shards from colliding. */
const TEST_QUEUE_PREFIX = `test-marketer-publish-${process.pid}-${Date.now()}`;

async function pingRedis(url: string): Promise<boolean> {
  const probe = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: PING_TIMEOUT_MS,
    retryStrategy: () => null,
  });
  /** Swallow the inevitable ECONNREFUSED when Redis is absent so vitest output stays clean. */
  probe.on("error", () => {});
  try {
    await probe.connect();
    const reply = await probe.ping();
    return reply === "PONG";
  } catch {
    return false;
  } finally {
    try {
      probe.disconnect();
    } catch {
      /* ignore */
    }
  }
}

const preferredUrl =
  process.env.REDIS_URL?.trim() || DEFAULT_REDIS_URL;

/** Snapshot before any test-time mutation of `REDIS_URL`. */
const priorRedisEnv = process.env.REDIS_URL;

let resolvedRedisUrl = preferredUrl;
let embeddedServer: RedisMemoryServer | null = null;

const redisAvailable = await (async (): Promise<boolean> => {
  if (await pingRedis(preferredUrl)) {
    resolvedRedisUrl = preferredUrl;
    return true;
  }
  if (process.env.MARKETER_SKIP_EMBEDDED_REDIS === "1") {
    return false;
  }
  try {
    const server = await RedisMemoryServer.create();
    const host = await server.getHost();
    const port = await server.getPort();
    const url = `redis://${host}:${port}`;
    if (!(await pingRedis(url))) {
      await server.stop();
      return false;
    }
    embeddedServer = server;
    resolvedRedisUrl = url;
    return true;
  } catch {
    return false;
  }
})();

/** True when we pointed `process.env.REDIS_URL` at the PING-verified broker. */
let redisEnvMutatedForSuite = false;
if (redisAvailable && process.env.REDIS_URL !== resolvedRedisUrl) {
  process.env.REDIS_URL = resolvedRedisUrl;
  redisEnvMutatedForSuite = true;
}

describe.skipIf(!redisAvailable)("publish queue roundtrip (real Redis)", () => {
  /**
   * Each test gets its own queue name so jobs from a prior run can't bleed in
   * if the suite was killed without cleanup.
   */
  function makeQueueName(suffix: string): string {
    return `${TEST_QUEUE_PREFIX}-${suffix}`;
  }

  const cleanups: Array<() => Promise<void>> = [];

  afterAll(async () => {
    while (cleanups.length > 0) {
      const fn = cleanups.pop();
      if (fn) {
        try {
          await fn();
        } catch {
          /* best-effort */
        }
      }
    }
    if (embeddedServer) {
      try {
        await embeddedServer.stop();
      } catch {
        /* ignore */
      }
      embeddedServer = null;
    }
    if (redisEnvMutatedForSuite) {
      if (priorRedisEnv === undefined) {
        delete process.env.REDIS_URL;
      } else {
        process.env.REDIS_URL = priorRedisEnv;
      }
      redisEnvMutatedForSuite = false;
    }
  });

  beforeAll(() => {
    if (!redisAvailable) {
      console.warn(
        `[publish-roundtrip] Skipping: Redis not reachable at ${preferredUrl} and embedded Redis failed`,
      );
    }
  });

  it("enqueues a job and the worker resolves it with the processor result", async () => {
    const queueName = makeQueueName("happy-path");

    const producerConn = createRedisConnection(resolvedRedisUrl);
    const workerConn = createRedisConnection(resolvedRedisUrl);
    const queue = new Queue<PublishJobPayload>(queueName, {
      connection: producerConn,
    });

    cleanups.push(async () => {
      await queue.close();
      producerConn.disconnect();
    });

    const observed: PublishJobPayload[] = [];
    const worker = createPublishWorker(
      workerConn,
      async (job) => {
        observed.push(job.data);
        return {
          ok: true,
          detail: "processed_in_test",
          externalId: `ext-${job.id ?? "unknown"}`,
        } satisfies PublishJobResult;
      },
      { queueName },
    );
    cleanups.push(async () => {
      await worker.close();
      workerConn.disconnect();
    });

    await worker.waitUntilReady();

    const completed = new Promise<Job<PublishJobPayload, PublishJobResult>>(
      (resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("worker did not complete job in time")),
          7000,
        );
        worker.once("completed", (job) => {
          clearTimeout(timer);
          resolve(job as Job<PublishJobPayload, PublishJobResult>);
        });
        worker.once("failed", (_job, err) => {
          clearTimeout(timer);
          reject(err);
        });
      },
    );

    const idempotencyKey = `roundtrip-${Date.now()}`;
    const enqueued = await enqueuePublishJob(queue, {
      scheduleEntryId: "schedule-roundtrip",
      tenantId: "tenant-roundtrip",
      idempotencyKey,
      correlationId: "publish-roundtrip.test",
      network: "meta",
    });

    expect(enqueued.id).toBe(idempotencyKey);

    const job = await completed;
    expect(job.returnvalue).toEqual({
      ok: true,
      detail: "processed_in_test",
      externalId: `ext-${idempotencyKey}`,
    });
    expect(observed).toHaveLength(1);
    expect(observed[0]?.scheduleEntryId).toBe("schedule-roundtrip");
  }, 15000);

  it("dedupes by idempotencyKey when the second enqueue uses the same key", async () => {
    const queueName = makeQueueName("dedupe");

    const conn = createRedisConnection(resolvedRedisUrl);
    const queue = createPublishQueue(conn);
    /** Override the production-shaped queue with a per-test queue name. */
    await queue.close();
    const isolatedQueue = new Queue<PublishJobPayload>(queueName, {
      connection: conn,
    });
    cleanups.push(async () => {
      await isolatedQueue.close();
      conn.disconnect();
    });

    const idempotencyKey = `dedupe-${Date.now()}`;
    const first = await enqueuePublishJob(isolatedQueue, {
      scheduleEntryId: "schedule-dedupe",
      tenantId: "tenant-dedupe",
      idempotencyKey,
    });
    const second = await enqueuePublishJob(isolatedQueue, {
      scheduleEntryId: "schedule-dedupe",
      tenantId: "tenant-dedupe",
      idempotencyKey,
    });

    expect(first.id).toBe(idempotencyKey);
    /**
     * BullMQ returns the existing job (same id) when `jobId` collides — we
     * verify both producers landed on the same record rather than spawning
     * a duplicate publish.
     */
    expect(second.id).toBe(first.id);
  }, 10000);
});
