/**
 * Phase 15 — Content safety & compliance HTTP server.
 *
 * npm run start:safety -w @home-link/marketer-api
 *
 * Env:
 *   SAFETY_PORT                (default 8807)
 *   SAFETY_HOST                (default 127.0.0.1)
 *   MARKETER_SAFETY_HTTP_CORS
 *   DATABASE_URL
 *   OPENAI_API_KEY
 */

import { createServer } from "node:http";
import { closePostgres } from "./db/postgres.js";
import { buildSafetyRouter } from "./marketer-pro/safety-route.js";

const host = process.env.SAFETY_HOST ?? "127.0.0.1";
const port = Number(process.env.SAFETY_PORT ?? 8807);
const cors = process.env.MARKETER_SAFETY_HTTP_CORS ?? "*";

const router = buildSafetyRouter();

const server = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", cors);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-workspace-id");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  router(req, res).catch((err) => {
    console.error(JSON.stringify({ level: "error", event: "safety_unhandled", message: String(err) }));
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal_error" }));
    }
  });
});

server.listen(port, host, () => {
  console.log(JSON.stringify({ level: "info", event: "safety_server_listen", host, port }));
});

async function shutdown(signal: string) {
  console.log(JSON.stringify({ level: "info", event: "safety_server_shutdown", signal }));
  await new Promise<void>((resolve) => server.close(() => resolve()));
  try { await closePostgres(); } catch { /* ignore */ }
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => { shutdown(sig).catch(() => process.exit(1)); });
}
