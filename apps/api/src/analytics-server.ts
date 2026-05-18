/**
 * Phase 10 — Analytics ingestion HTTP server.
 *
 * npm run start:analytics -w @home-link/marketer-api
 *
 * Env:
 *   ANALYTICS_PORT                (default 8802)
 *   ANALYTICS_HOST                (default 127.0.0.1)
 *   MARKETER_ANALYTICS_HTTP_CORS
 *   MARKETER_META_ACCESS_TOKEN
 *   MARKETER_X_ACCESS_TOKEN
 *   MARKETER_LINKEDIN_ACCESS_TOKEN
 *   MARKETER_YOUTUBE_ACCESS_TOKEN
 *   DATABASE_URL
 */

import { createServer } from "node:http";
import { closePostgres } from "./db/postgres.js";
import { handleAnalyticsRequest } from "./marketer-pro/analytics-route.js";
import { requireAuth } from "./marketer-pro/auth/middleware.js";

const host = process.env.ANALYTICS_HOST ?? "127.0.0.1";
const port = Number(process.env.ANALYTICS_PORT ?? 8802);

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  const auth = await requireAuth(req, res);
  if (!auth) return;
  req.headers["x-tenant-id"] = auth.tenantId;
  handleAnalyticsRequest(req, res).catch((err) => {
    console.error(JSON.stringify({ level: "error", event: "analytics_unhandled", message: String(err) }));
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal_error" }));
    }
  });
});

server.listen(port, host, () => {
  console.log(JSON.stringify({
    level: "info", event: "analytics_server_listen", host, port,
    cors: process.env.MARKETER_ANALYTICS_HTTP_CORS ? "on" : "off",
  }));
});

async function shutdown(signal: string) {
  console.log(JSON.stringify({ level: "info", event: "analytics_server_shutdown", signal }));
  await new Promise<void>((resolve) => server.close(() => resolve()));
  try { await closePostgres(); } catch { /* ignore */ }
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => { shutdown(sig).catch(() => process.exit(1)); });
}
