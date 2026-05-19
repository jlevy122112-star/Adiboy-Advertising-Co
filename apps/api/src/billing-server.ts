/**
 * Stripe billing HTTP server.
 *
 *   npm run build -w @home-link/marketer-api
 *   node apps/api/dist/billing-server.js
 *
 * Env:
 *   BILLING_HOST              (default 127.0.0.1)
 *   BILLING_PORT              (default 8806)
 *   STRIPE_SECRET_KEY         — required for live Stripe calls
 *   STRIPE_WEBHOOK_SECRET     — required for webhook signature verification
 *   STRIPE_PRICE_PRO_MONTHLY  — Stripe price ID
 *   STRIPE_PRICE_PRO_ANNUAL   — Stripe price ID
 *   STRIPE_PRICE_ENT_MONTHLY  — Stripe price ID
 *   STRIPE_PRICE_ENT_ANNUAL   — Stripe price ID
 *   APP_URL                   — frontend origin for redirect URLs
 *   BILLING_CORS              — allowed CORS origin (defaults to APP_URL)
 *   MARKETER_JWT_SECRET       — for requireAuth
 *   DATABASE_URL              — Postgres
 */

import { createServer } from "node:http";
import { handleBillingRequest } from "./marketer-pro/billing-route.js";

const host = process.env.BILLING_HOST ?? "127.0.0.1";
const port = Number(process.env.BILLING_PORT ?? 8806);

const MAX_BODY = 2 * 1024 * 1024; // 2 MB — Stripe raw body can be large

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    await handleBillingRequest(req, res).catch(() => {});
    return;
  }

  let size = 0;
  req.on("data", (chunk: Buffer) => {
    size += chunk.length;
    if (size > MAX_BODY) req.destroy(new Error("payload_too_large"));
  });

  try {
    await handleBillingRequest(req, res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ level: "error", event: "billing_server_error", message: msg }));
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal_error" }));
    }
  }
});

server.listen(port, host, () => {
  console.log(JSON.stringify({
    level: "info",
    event: "billing_server_listen",
    host,
    port,
    stripe: !!process.env.STRIPE_SECRET_KEY,
    webhook: !!process.env.STRIPE_WEBHOOK_SECRET,
  }));
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
