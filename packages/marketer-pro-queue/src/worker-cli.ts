/**
 * Production-style worker entry — usable after `npm run build -w @home-link/marketer-pro-queue`.
 *
 * REDIS_URL=redis://127.0.0.1:6379 node packages/marketer-pro-queue/dist/worker-cli.js
 */

import { createRedisConnection } from "./redis.js";
import { createPublishWorker } from "./publish-worker.js";
import { classifyPublishNetwork } from "./publish-network.js";
import {
  resolvePublishRunnerFromEnv,
  type PublishRunnerWithContext,
} from "./publish-runner.js";

const connection = createRedisConnection();

const runner: PublishRunnerWithContext = resolvePublishRunnerFromEnv();

console.log(
  JSON.stringify({
    level: "info",
    event: "publish_runner_selected",
    runner: process.env.MARKETER_PUBLISH_HTTP_URL?.trim()
      ? "http"
      : "stub",
  }),
);

const worker = createPublishWorker(connection, async (job) => {
  const payload = job.data;
  const attempt = job.attemptsMade + 1;
  console.log(
    JSON.stringify({
      level: "info",
      event: "publish_job_received",
      jobId: job.id,
      name: job.name,
      scheduleEntryId: payload.scheduleEntryId,
      tenantId: payload.tenantId,
      attempt,
      correlationId: payload.correlationId ?? null,
      publishNetwork: classifyPublishNetwork(payload.network),
      networkRaw: payload.network ?? null,
    }),
  );

  return runner(payload, { jobId: job.id, attempt });
});

worker.on("completed", (job) => {
  console.log(
    JSON.stringify({
      level: "info",
      event: "job_completed",
      jobId: job.id,
      returnvalue: job.returnvalue,
    }),
  );
});

worker.on("failed", (job, err) => {
  console.error(
    JSON.stringify({
      level: "error",
      event: "job_failed",
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
      error: err instanceof Error ? err.message : String(err),
    }),
  );
});

worker.on("stalled", (jobId) => {
  console.warn(
    JSON.stringify({
      level: "warn",
      event: "job_stalled",
      jobId,
    }),
  );
});

async function shutdown(signal: string) {
  console.log(
    JSON.stringify({
      level: "info",
      event: "worker_shutdown",
      signal,
    }),
  );
  await worker.close();
  await connection.quit();
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    shutdown(sig).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  });
}
