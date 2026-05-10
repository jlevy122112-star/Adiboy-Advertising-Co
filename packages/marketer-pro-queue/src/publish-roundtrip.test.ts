/**
 * Real-Redis roundtrip: enqueue → worker processes → result returned.
 *
 * Skips automatically when Redis is unreachable so the unit suite stays green
 * on dev machines without a local broker. CI and any developer with
 * `redis://127.0.0.1:6379` (or a custom `REDIS_URL`) will exercise the path.
 *
 * Run alone:
 *   REDIS_URL=redis://127.0.0.1:6379 npx vitest run \
 *     packages/marketer-pro-queue/src/publish-roundtrip.test.ts
 */

import { Queue, type Job } from "bullmq";
import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type PublishJobPayload,
  type PublishJobResult,
} from "./publish-job.js";
import { createPublishQueue, enqueuePublishJob } from "./publish-queue.js";
import { createPublishWorker } from "./publish-worker.js";
import { createRedisConnection, DEFAULT_REDIS_URL } from "./redis.js";

const REDIS_URL = process.env.REDIS_URL ?? DEFAULT_REDIS_URL;
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

const redisAvailable = await pingRedis(REDIS_URL);

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
  });

  beforeAll(() => {
    if (!redisAvailable) {
      console.warn(
        `[publish-roundtrip] Skipping: Redis not reachable at ${REDIS_URL}`,
      );
    }
  });

  it("enqueues a job and the worker resolves it with the processor result", async () => {
    const queueName = makeQueueName("happy-path");

    const producerConn = createRedisConnection(REDIS_URL);
    const workerConn = createRedisConnection(REDIS_URL);
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
      network: "test",
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

    const conn = createRedisConnection(REDIS_URL);
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
