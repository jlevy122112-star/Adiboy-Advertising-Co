/**
 * Weekly viral loop report worker — runs via cron or manual trigger.
 *
 *   node apps/api/dist/viral-report-worker.js
 *
 * Env: DATABASE_URL, REDIS_URL
 */

import { createRedisConnection } from "@home-link/marketer-pro-queue";
import { Worker } from "bullmq";
import { getViralMetrics } from "./db/viral-loop.js";

const QUEUE_NAME = "marketer-viral-reports";

const redis = createRedisConnection();

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { tenantId, windowDays = 7 } = job.data as { tenantId: string; windowDays?: number };
    const metrics = await getViralMetrics(tenantId, windowDays);

    console.log(JSON.stringify({
      level: "info",
      event: "viral_report_generated",
      tenantId,
      windowDays,
      metrics,
    }));

    // Auto-optimize: if viral coefficient drops below 0.1, flag for branding nudge
    if (metrics.viralCoefficient < 0.1 && metrics.totalShares > 10) {
      console.log(JSON.stringify({
        level: "info",
        event: "viral_branding_nudge",
        tenantId,
        reason: "low_viral_coefficient",
        viralCoefficient: metrics.viralCoefficient,
      }));
    }

    return metrics;
  },
  { connection: redis, concurrency: 5 },
);

worker.on("completed", (job) => {
  console.log(JSON.stringify({ level: "info", event: "viral_report_done", jobId: job.id }));
});

worker.on("failed", (job, err) => {
  console.error(JSON.stringify({ level: "error", event: "viral_report_failed", jobId: job?.id, message: err.message }));
});

console.log(JSON.stringify({ level: "info", event: "viral_report_worker_started", queue: QUEUE_NAME }));

async function shutdown(signal: string) {
  console.log(JSON.stringify({ level: "info", event: "viral_report_worker_shutdown", signal }));
  await worker.close();
  await redis.quit().catch(() => {});
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => shutdown(sig).catch(() => process.exit(1)));
}
