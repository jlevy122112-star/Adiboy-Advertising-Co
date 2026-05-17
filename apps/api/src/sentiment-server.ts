/**
 * Phase 11 — Sentiment & social listening HTTP server.
 *
 * npm run start:sentiment -w @home-link/marketer-api
 *
 * Env:
 *   SENTIMENT_PORT                (default 8803)
 *   SENTIMENT_HOST                (default 127.0.0.1)
 *   MARKETER_SENTIMENT_HTTP_CORS
 *   MARKETER_OPENAI_API_KEY
 *   MARKETER_META_ACCESS_TOKEN
 *   MARKETER_X_ACCESS_TOKEN
 *   MARKETER_LINKEDIN_ACCESS_TOKEN
 *   MARKETER_YOUTUBE_ACCESS_TOKEN
 *   DATABASE_URL
 */

import { createServer } from "node:http";
import { closePostgres } from "./db/postgres.js";
import { handleSentimentRequest } from "./marketer-pro/sentiment-route.js";

const host = process.env.SENTIMENT_HOST ?? "127.0.0.1";
const port = Number(process.env.SENTIMENT_PORT ?? 8803);

const server = createServer((req, res) => {
  handleSentimentRequest(req, res).catch((err) => {
    console.error(JSON.stringify({ level: "error", event: "sentiment_unhandled", message: String(err) }));
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal_error" }));
    }
  });
});

server.listen(port, host, () => {
  console.log(JSON.stringify({ level: "info", event: "sentiment_server_listen", host, port }));
});

async function shutdown(signal: string) {
  console.log(JSON.stringify({ level: "info", event: "sentiment_server_shutdown", signal }));
  await new Promise<void>((resolve) => server.close(() => resolve()));
  try { await closePostgres(); } catch { /* ignore */ }
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => { shutdown(sig).catch(() => process.exit(1)); });
}
