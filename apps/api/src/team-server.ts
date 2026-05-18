/**
 * Phase 14 — Team collaboration HTTP server.
 *
 * npm run start:team -w @home-link/marketer-api
 *
 * Env:
 *   TEAM_PORT                  (default 8806)
 *   TEAM_HOST                  (default 127.0.0.1)
 *   MARKETER_TEAM_HTTP_CORS
 *   DATABASE_URL
 */

import { createServer } from "node:http";
import { closePostgres } from "./db/postgres.js";
import { handleTeamRequest } from "./marketer-pro/team-route.js";
import { requireAuth } from "./marketer-pro/auth/middleware.js";

const host = process.env.TEAM_HOST ?? "127.0.0.1";
const port = Number(process.env.TEAM_PORT ?? 8806);

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  const auth = await requireAuth(req, res);
  if (!auth) return;
  req.headers["x-tenant-id"] = auth.tenantId;
  handleTeamRequest(req, res).catch((err) => {
    console.error(JSON.stringify({ level: "error", event: "team_unhandled", message: String(err) }));
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal_error" }));
    }
  });
});

server.listen(port, host, () => {
  console.log(JSON.stringify({ level: "info", event: "team_server_listen", host, port }));
});

async function shutdown(signal: string) {
  console.log(JSON.stringify({ level: "info", event: "team_server_shutdown", signal }));
  await new Promise<void>((resolve) => server.close(() => resolve()));
  try { await closePostgres(); } catch { /* ignore */ }
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => { shutdown(sig).catch(() => process.exit(1)); });
}
