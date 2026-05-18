/**
 * Phase 9 — SERP brief HTTP server.
 *
 * npm run start:serp-brief -w @home-link/marketer-api
 *
 * Env:
 *   SERP_BRIEF_PORT       (default 8801)
 *   SERP_BRIEF_HOST       (default 127.0.0.1)
 *   MARKETER_SERP_HTTP_CORS
 *   SERPAPI_KEY           — SerpAPI key (omit to use stub results)
 *   MARKETER_OPENAI_API_KEY / OPENAI_API_KEY
 *   DATABASE_URL
 */

import { createServer } from "node:http";
import { closePostgres } from "./db/postgres.js";
import { handleSerpRequest } from "./marketer-pro/serp-route.js";
import { requireAuth } from "./marketer-pro/auth/middleware.js";

const host = process.env.SERP_BRIEF_HOST ?? "127.0.0.1";
const port = Number(process.env.SERP_BRIEF_PORT ?? 8801);

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  const auth = await requireAuth(req, res);
  if (!auth) return;
  req.headers["x-tenant-id"] = auth.tenantId;
  handleSerpRequest(req, res).catch((err) => {
    console.error(JSON.stringify({ level: "error", event: "serp_unhandled", message: String(err) }));
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal_error" }));
    }
  });
});

server.listen(port, host, () => {
  console.log(JSON.stringify({
    level: "info", event: "serp_brief_server_listen", host, port,
    serp: process.env.SERPAPI_KEY ? "serpapi" : "stub",
    ai: (process.env.MARKETER_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY) ? "openai" : "stub",
    cors: process.env.MARKETER_SERP_HTTP_CORS ? "on" : "off",
  }));
});

async function shutdown(signal: string) {
  console.log(JSON.stringify({ level: "info", event: "serp_brief_server_shutdown", signal }));
  await new Promise<void>((resolve) => server.close(() => resolve()));
  try { await closePostgres(); } catch { /* ignore */ }
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => { shutdown(sig).catch(() => process.exit(1)); });
}
