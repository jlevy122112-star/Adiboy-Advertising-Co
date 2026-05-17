/**
 * Phase 13 — Autonomous workflow agents HTTP server.
 *
 * npm run start:autonomous -w @home-link/marketer-api
 *
 * Env:
 *   AUTONOMOUS_PORT               (default 8805)
 *   AUTONOMOUS_HOST               (default 127.0.0.1)
 *   MARKETER_AUTONOMOUS_HTTP_CORS
 *   MARKETER_OPENAI_API_KEY
 *   DATABASE_URL
 */

import { createServer } from "node:http";
import { closePostgres } from "./db/postgres.js";
import { handleAutonomousRequest } from "./marketer-pro/autonomous-route.js";

const host = process.env.AUTONOMOUS_HOST ?? "127.0.0.1";
const port = Number(process.env.AUTONOMOUS_PORT ?? 8805);

const server = createServer((req, res) => {
  handleAutonomousRequest(req, res).catch((err) => {
    console.error(JSON.stringify({ level: "error", event: "autonomous_unhandled", message: String(err) }));
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal_error" }));
    }
  });
});

server.listen(port, host, () => {
  console.log(JSON.stringify({ level: "info", event: "autonomous_server_listen", host, port }));
});

async function shutdown(signal: string) {
  console.log(JSON.stringify({ level: "info", event: "autonomous_server_shutdown", signal }));
  await new Promise<void>((resolve) => server.close(() => resolve()));
  try { await closePostgres(); } catch { /* ignore */ }
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => { shutdown(sig).catch(() => process.exit(1)); });
}
