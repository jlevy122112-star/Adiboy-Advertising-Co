/**
 * Phase 6 — HTTP server for image generation, moderation, and approval.
 *
 *   npm run build -w @home-link/marketer-api
 *   node apps/api/dist/image-gen-server.js
 *
 * Env:
 *   IMAGE_GEN_HOST  (default 127.0.0.1)
 *   IMAGE_GEN_PORT  (default 8796)
 *   MARKETER_IMAGE_GEN_HTTP_TOKEN  — optional Bearer auth
 *   MARKETER_IMAGE_GEN_HTTP_CORS   — optional CORS origin(s)
 *   MARKETER_OPENAI_API_KEY / OPENAI_API_KEY  — DALL-E 3
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_REGION, AWS_S3_BUCKET
 *   DATABASE_URL — Postgres
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { closePostgres } from "./db/postgres.js";
import { handleImageGenRequest } from "./marketer-pro/image-gen-route.js";

const MAX_BODY_BYTES = 2 * 1024 * 1024;

const host = process.env.IMAGE_GEN_HOST ?? "127.0.0.1";
const port = Number(process.env.IMAGE_GEN_PORT ?? 8796);

function checkBearer(req: IncomingMessage, res: ServerResponse): boolean {
  const expected = process.env.MARKETER_IMAGE_GEN_HTTP_TOKEN?.trim();
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

function addSecurityHeaders(res: ServerResponse): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
}

const server = createServer(async (req, res) => {
  addSecurityHeaders(res);

  if (req.method === "OPTIONS") {
    handleImageGenRequest(req, res).catch(() => {});
    return;
  }

  if (!checkBearer(req, res)) return;

  // Enforce body size limit
  let size = 0;
  req.on("data", (chunk: Buffer) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) req.destroy(new Error("payload_too_large"));
  });

  try {
    await handleImageGenRequest(req, res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "payload_too_large") {
      res.writeHead(413, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "payload_too_large" }));
      return;
    }
    console.error(JSON.stringify({ level: "error", event: "image_gen_server_error", message: msg }));
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal_error" }));
    }
  }
});

server.listen(port, host, () => {
  console.log(JSON.stringify({
    level: "info",
    event: "image_gen_server_listen",
    host,
    port,
    auth: process.env.MARKETER_IMAGE_GEN_HTTP_TOKEN ? "bearer" : "none",
    cors: process.env.MARKETER_IMAGE_GEN_HTTP_CORS ? "on" : "off",
    openai: !!(process.env.MARKETER_OPENAI_API_KEY || process.env.OPENAI_API_KEY),
    s3: !!(process.env.AWS_S3_BUCKET),
    database: !!process.env.DATABASE_URL,
  }));
});

async function shutdown(signal: string) {
  console.log(JSON.stringify({ level: "info", event: "image_gen_server_shutdown", signal }));
  await new Promise<void>((r) => server.close(() => r()));
  await closePostgres().catch(() => {});
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => shutdown(sig).catch(() => process.exit(1)));
}
