/**
 * Phase 7 — HTTP server for video generation.
 *
 *   npm run build -w @home-link/marketer-api
 *   node apps/api/dist/video-gen-server.js
 *
 * Env:
 *   VIDEO_GEN_HOST  (default 127.0.0.1)
 *   VIDEO_GEN_PORT  (default 8797)
 *   REDIS_URL       (default redis://127.0.0.1:6379)
 *   MARKETER_VIDEO_GEN_HTTP_TOKEN  — optional Bearer auth
 *   MARKETER_VIDEO_GEN_HTTP_CORS   — optional CORS origin(s)
 *   MARKETER_OPENAI_API_KEY / OPENAI_API_KEY  — required
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_REGION, AWS_S3_BUCKET
 *   DATABASE_URL
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createRedisConnection, createVideoRenderQueue } from "@home-link/marketer-pro-queue";
import { closePostgres } from "./db/postgres.js";
import { makeVideoGenHandler } from "./marketer-pro/video-gen-route.js";

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const host = process.env.VIDEO_GEN_HOST ?? "127.0.0.1";
const port = Number(process.env.VIDEO_GEN_PORT ?? 8797);

const redis = createRedisConnection();
const videoQueue = createVideoRenderQueue(redis);
const handleVideoGenRequest = makeVideoGenHandler(videoQueue);

function checkBearer(req: IncomingMessage, res: ServerResponse): boolean {
  const expected = process.env.MARKETER_VIDEO_GEN_HTTP_TOKEN?.trim();
  if (!expected) return true;
  const auth = req.headers.authorization?.trim();
  if (!auth?.toLowerCase().startsWith("bearer ")) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized" }));
    return false;
  }
  if (auth.slice(7).trim() !== expected) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "unauthorized" }));
    return false;
  }
  return true;
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    handleVideoGenRequest(req, res).catch(() => {});
    return;
  }

  if (!checkBearer(req, res)) return;

  let size = 0;
  req.on("data", (chunk: Buffer) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) req.destroy(new Error("payload_too_large"));
  });

  try {
    await handleVideoGenRequest(req, res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "payload_too_large") {
      res.writeHead(413, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "payload_too_large" }));
      return;
    }
    console.error(JSON.stringify({ level: "error", event: "video_gen_server_error", message: msg }));
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal_error" }));
    }
  }
});

server.listen(port, host, () => {
  console.log(JSON.stringify({
    level: "info",
    event: "video_gen_server_listen",
    host,
    port,
    auth: !!process.env.MARKETER_VIDEO_GEN_HTTP_TOKEN,
    openai: !!(process.env.MARKETER_OPENAI_API_KEY || process.env.OPENAI_API_KEY),
    s3: !!process.env.AWS_S3_BUCKET,
    database: !!process.env.DATABASE_URL,
    redis: !!process.env.REDIS_URL,
  }));
});

async function shutdown(signal: string) {
  console.log(JSON.stringify({ level: "info", event: "video_gen_server_shutdown", signal }));
  await new Promise<void>((r) => server.close(() => r()));
  await videoQueue.close().catch(() => {});
  await redis.quit().catch(() => {});
  await closePostgres().catch(() => {});
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => shutdown(sig).catch(() => process.exit(1)));
}
