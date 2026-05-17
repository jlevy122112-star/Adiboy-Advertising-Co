/**
 * Phase 8 — Authentication & Authorization HTTP server.
 *
 *   npm run build -w @home-link/marketer-api
 *   node apps/api/dist/auth-server.js
 *
 * Env:
 *   AUTH_HOST          (default 127.0.0.1)
 *   AUTH_PORT          (default 8798)
 *   MARKETER_JWT_SECRET        — required, HS256 signing key
 *   MARKETER_AUTH_HTTP_CORS    — optional CORS origin
 *   DATABASE_URL               — Postgres
 */

import { createServer } from "node:http";
import { closePostgres } from "./db/postgres.js";
import { handleAuthRequest } from "./marketer-pro/auth-route.js";

const MAX_BODY_BYTES = 64 * 1024; // 64 KB — auth payloads are tiny

const host = process.env.AUTH_HOST ?? "127.0.0.1";
const port = Number(process.env.AUTH_PORT ?? 8798);

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    await handleAuthRequest(req, res).catch(() => {});
    return;
  }

  let size = 0;
  req.on("data", (chunk: Buffer) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) req.destroy(new Error("payload_too_large"));
  });

  try {
    await handleAuthRequest(req, res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "payload_too_large") {
      res.writeHead(413, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "payload_too_large" }));
      return;
    }
    console.error(JSON.stringify({ level: "error", event: "auth_server_error", message: msg }));
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal_error" }));
    }
  }
});

server.listen(port, host, () => {
  console.log(JSON.stringify({
    level: "info",
    event: "auth_server_listen",
    host,
    port,
    jwt: !!process.env.MARKETER_JWT_SECRET,
    cors: process.env.MARKETER_AUTH_HTTP_CORS ? "on" : "off",
    database: !!process.env.DATABASE_URL,
  }));
});

async function shutdown(signal: string) {
  console.log(JSON.stringify({ level: "info", event: "auth_server_shutdown", signal }));
  await new Promise<void>((r) => server.close(() => r()));
  await closePostgres().catch(() => {});
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => shutdown(sig).catch(() => process.exit(1)));
}
