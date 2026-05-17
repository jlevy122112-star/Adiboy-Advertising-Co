/**
 * Phase 9 — Viral Loop HTTP server (port 8800).
 *
 *   npm run build -w @home-link/marketer-api
 *   node apps/api/dist/viral-loop-server.js
 *
 * Env:
 *   VIRAL_HOST               (default 127.0.0.1)
 *   VIRAL_PORT               (default 8800)
 *   MARKETER_JWT_SECRET      — required for requireAuth
 *   MARKETER_PUBLIC_URL      — base URL for share links
 *   MARKETER_VIRAL_HTTP_CORS — CORS origin (default *)
 *   DATABASE_URL             — Postgres
 */

import { createServer } from "node:http";
import { closePostgres } from "./db/postgres.js";
import { handleViralLoopRequest } from "./marketer-pro/viral-loop-route.js";

const host = process.env.VIRAL_HOST ?? "127.0.0.1";
const port = Number(process.env.VIRAL_PORT ?? 8800);

const server = createServer(async (req, res) => {
  try {
    await handleViralLoopRequest(req, res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ level: "error", event: "viral_server_error", message: msg }));
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal_error" }));
    }
  }
});

server.listen(port, host, () => {
  console.log(JSON.stringify({
    level: "info", event: "viral_server_listen", host, port,
    jwt: !!process.env.MARKETER_JWT_SECRET,
    database: !!process.env.DATABASE_URL,
  }));
});

async function shutdown(signal: string) {
  console.log(JSON.stringify({ level: "info", event: "viral_server_shutdown", signal }));
  await new Promise<void>((r) => server.close(() => r()));
  await closePostgres().catch(() => {});
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => shutdown(sig).catch(() => process.exit(1)));
}
