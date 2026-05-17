/**
 * Phase 7 — BullMQ worker for video rendering.
 *
 *   npm run build -w @home-link/marketer-api
 *   node apps/api/dist/video-worker-cli.js
 *
 * Env:
 *   REDIS_URL  (default redis://127.0.0.1:6379)
 *   MARKETER_OPENAI_API_KEY / OPENAI_API_KEY
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_REGION, AWS_S3_BUCKET
 *   DATABASE_URL
 *   MARKETER_VIDEO_RENDER_CONCURRENCY  (default 2)
 */

import { createRedisConnection, createVideoRenderWorker } from "@home-link/marketer-pro-queue";
import { executeVideoRender } from "./marketer-pro/video-generate.js";
import { closePostgres } from "./db/postgres.js";

const connection = createRedisConnection();

const worker = createVideoRenderWorker(connection, async (job) => {
  const { scriptId, jobId, tenantId, voiceover } = job.data;

  console.log(JSON.stringify({
    level: "info", event: "video_render_job_received",
    bullJobId: job.id, scriptId, videoJobId: jobId, tenantId,
    attempt: job.attemptsMade + 1,
  }));

  const result = await executeVideoRender({ tenantId, scriptId, jobId, voiceover });

  console.log(JSON.stringify({
    level: result.ok ? "info" : "error",
    event: result.ok ? "video_render_job_done" : "video_render_job_failed",
    jobId: job.id, scriptId, tenantId,
    ...(result.ok
      ? { durationS: result.durationS, hasThumbnail: !!result.thumbnailUrl }
      : { error: result.error }),
  }));

  return {
    ok: result.ok,
    url: result.ok ? result.url : undefined,
    thumbnailUrl: result.ok ? (result.thumbnailUrl ?? undefined) : undefined,
    durationS: result.ok ? result.durationS : undefined,
    error: result.ok ? undefined : result.error,
  };
});

worker.on("failed", (job, err) => {
  console.error(JSON.stringify({
    level: "error", event: "video_render_worker_job_failed",
    jobId: job?.id, error: err instanceof Error ? err.message : String(err),
  }));
});

console.log(JSON.stringify({
  level: "info", event: "video_render_worker_started",
  openai: !!(process.env.MARKETER_OPENAI_API_KEY || process.env.OPENAI_API_KEY),
  s3: !!process.env.AWS_S3_BUCKET,
  database: !!process.env.DATABASE_URL,
}));

async function shutdown(signal: string) {
  console.log(JSON.stringify({ level: "info", event: "video_render_worker_shutdown", signal }));
  await worker.close();
  await connection.quit().catch(() => {});
  await closePostgres().catch(() => {});
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => shutdown(sig).catch(() => process.exit(1)));
}
