/**
 * Enqueues one `publish` job for local smoke testing (requires Redis + optional worker).
 *
 *   npm run queue:enqueue-smoke
 *
 * Env: REDIS_URL (default redis://127.0.0.1:6379)
 */

import {
  createRedisConnection,
  createPublishQueue,
  enqueuePublishJob,
} from "../packages/marketer-pro-queue/dist/index.js";

const stamp = `smoke-${Date.now()}`;
/** Fail fast when Redis is down (no endless reconnect spam). */
const connection = createRedisConnection(process.env.REDIS_URL, {
  enableOfflineQueue: false,
  retryStrategy(times) {
    if (times > 4) return null;
    return Math.min(times * 100, 500);
  },
});
const queue = createPublishQueue(connection);

try {
  const job = await enqueuePublishJob(queue, {
    scheduleEntryId: stamp,
    tenantId: "smoke-tenant",
    idempotencyKey: stamp,
    correlationId: "enqueue-publish-smoke.mjs",
    network: "smoke",
  });
  console.log(
    JSON.stringify({
      level: "info",
      event: "enqueue_smoke_ok",
      bullJobId: job.id,
      jobName: job.name,
      queueName: queue.name,
    }),
  );
} catch (err) {
  console.error(
    JSON.stringify({
      level: "error",
      event: "enqueue_smoke_failed",
      message: err instanceof Error ? err.message : String(err),
      hint: "Start Redis (e.g. docker run -d -p 6379:6379 redis:7-alpine) or set REDIS_URL.",
    }),
  );
  process.exitCode = 1;
} finally {
  try {
    await queue.close();
  } catch {
    /* ignore */
  }
  try {
    await connection.quit();
  } catch {
    /* ignore */
  }
}
