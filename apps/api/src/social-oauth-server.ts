/**
 * Phase 8 — Social OAuth HTTP server (port 8799).
 *
 *   npm run build -w @home-link/marketer-api
 *   node apps/api/dist/social-oauth-server.js
 *
 * Env:
 *   SOCIAL_OAUTH_HOST          (default 127.0.0.1)
 *   SOCIAL_OAUTH_PORT          (default 8799)
 *   MARKETER_JWT_SECRET        — required for requireAuth
 *   MARKETER_FRONTEND_URL      — redirect target after OAuth success
 *   X_CLIENT_ID / X_CLIENT_SECRET
 *   META_APP_ID / META_APP_SECRET
 *   LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET
 *   YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET
 *   DATABASE_URL               — Postgres
 */

import { createServer } from "node:http";
import { closePostgres } from "./db/postgres.js";
import { handleSocialOAuthRequest } from "./marketer-pro/social-oauth-route.js";

const host = process.env.SOCIAL_OAUTH_HOST ?? "127.0.0.1";
const port = Number(process.env.SOCIAL_OAUTH_PORT ?? 8799);

const server = createServer(async (req, res) => {
  try {
    await handleSocialOAuthRequest(req, res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ level: "error", event: "social_oauth_server_error", message: msg }));
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal_error" }));
    }
  }
});

server.listen(port, host, () => {
  console.log(JSON.stringify({
    level: "info",
    event: "social_oauth_server_listen",
    host,
    port,
    jwt: !!process.env.MARKETER_JWT_SECRET,
    database: !!process.env.DATABASE_URL,
  }));
});

async function shutdown(signal: string) {
  console.log(JSON.stringify({ level: "info", event: "social_oauth_server_shutdown", signal }));
  await new Promise<void>((r) => server.close(() => r()));
  await closePostgres().catch(() => {});
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => shutdown(sig).catch(() => process.exit(1)));
}
