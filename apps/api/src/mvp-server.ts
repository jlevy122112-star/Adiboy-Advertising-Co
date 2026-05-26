/**
 * MVP — unified HTTP server.
 * Serves the mobile prototype HTML + all API routes the frontend needs.
 *
 *   npm run build -w @home-link/marketer-api
 *   npm run start:mvp -w @home-link/marketer-api
 *
 * Env:
 *   MVP_HOST                   (default 0.0.0.0)
 *   MVP_PORT                   (default 8780)
 *   MARKETER_JWT_SECRET        required for auth
 *   DATABASE_URL               required for persistence
 *   ANTHROPIC_API_KEY          optional — Claude generation
 *   MARKETER_OPENAI_API_KEY    optional — OpenAI generation (fallback)
 *   MVP_CORS                   optional CORS origin (* or csv)
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import { closePostgres } from "./db/postgres.js";
import { requireAuth, securityHeaders } from "./marketer-pro/auth/middleware.js";
import { handleAuthRequest } from "./marketer-pro/auth-route.js";
import {
  executeUpsertBrandProfileRequest,
  executeGetBrandProfileRequestFromSearchParams,
} from "./marketer-pro/brand-profile-route.js";
import {
  insertScheduleEntry,
  listScheduleEntriesByTenant,
} from "./db/schedule-entry.js";
import { getAnalyticsSummary } from "./db/analytics-snapshot.js";
import { generatePosts, type GeneratePostsInput } from "./marketer-pro/mvp-generate-posts.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_HTML_PATH = join(__dirname, "../../marketer-pro-mobile/index.html");
const MAX_BODY = 256 * 1024;

const host = process.env.MVP_HOST ?? "0.0.0.0";
const port = Number(process.env.MVP_PORT ?? 8780);

function corsHeaders(req: IncomingMessage): Record<string, string> {
  const raw = process.env.MVP_CORS?.trim() ?? "*";
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  if (raw === "*") return { ...base, "Access-Control-Allow-Origin": "*" };
  const allowed = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.origin ?? "";
  if (!allowed.includes(origin)) return base;
  return { ...base, "Access-Control-Allow-Origin": origin, Vary: "Origin" };
}

function json(req: IncomingMessage, res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  const headers: Record<string, string | number> = {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    ...corsHeaders(req),
  };
  res.writeHead(status, headers);
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    total += buf.length;
    if (total > MAX_BODY) throw new Error("payload_too_large");
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw.trim() ? (JSON.parse(raw) as unknown) : undefined;
}

function serveFrontend(res: ServerResponse): void {
  try {
    const html = readFileSync(FRONTEND_HTML_PATH, "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } catch {
    res.writeHead(503, { "Content-Type": "text/plain" });
    res.end("Frontend not found. Run the build first.");
  }
}

const GeneratePostsBodyShape = {
  validate(body: unknown): GeneratePostsInput | null {
    if (typeof body !== "object" || body === null) return null;
    const b = body as Record<string, unknown>;
    if (!Array.isArray(b.platforms) || !b.platforms.length) return null;
    if (typeof b.topic !== "string" || !b.topic.trim()) return null;
    return {
      platforms: (b.platforms as unknown[]).filter((p): p is string => typeof p === "string"),
      topic: String(b.topic),
      contentGoal: typeof b.contentGoal === "string" ? b.contentGoal : "Build brand awareness",
      cta: typeof b.cta === "string" ? b.cta : "Learn more",
      hashtagStrategy: typeof b.hashtagStrategy === "string" ? b.hashtagStrategy : "Broad reach (10–15 hashtags)",
      urgency: typeof b.urgency === "string" ? b.urgency : "Normal",
      brandName: typeof b.brandName === "string" ? b.brandName : undefined,
      brandVoice: typeof b.brandVoice === "string" ? b.brandVoice : undefined,
    };
  },
};

const server = createServer(async (req, res) => {
  securityHeaders(res);

  if (req.method === "OPTIONS") {
    const c = corsHeaders(req);
    res.writeHead(204, c);
    res.end();
    return;
  }

  let url: URL;
  try {
    url = new URL(req.url ?? "/", `http://${host}`);
  } catch {
    json(req, res, 400, { error: "bad_url" });
    return;
  }
  const path = url.pathname;

  // ── Serve frontend ────────────────────────────────────────────────────────
  if (req.method === "GET" && (path === "/" || path === "/index.html")) {
    serveFrontend(res);
    return;
  }

  // ── Auth routes (no JWT required) ─────────────────────────────────────────
  if (path.startsWith("/auth/")) {
    await handleAuthRequest(req, res);
    return;
  }

  // ── All /api/* routes require JWT ─────────────────────────────────────────
  if (!path.startsWith("/api/")) {
    json(req, res, 404, { error: "not_found" });
    return;
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;

  // ── POST /api/generate ────────────────────────────────────────────────────
  if (req.method === "POST" && path === "/api/generate") {
    let body: unknown;
    try {
      body = await readBody(req);
    } catch {
      json(req, res, 413, { error: "payload_too_large" });
      return;
    }
    const input = GeneratePostsBodyShape.validate(body);
    if (!input) {
      json(req, res, 400, { error: "validation_error", message: "platforms[] and topic are required" });
      return;
    }
    try {
      const posts = await generatePosts(input);
      json(req, res, 200, { posts });
    } catch (err) {
      console.error(JSON.stringify({ level: "error", event: "mvp_generate_error", message: String(err) }));
      json(req, res, 500, { error: "generation_failed" });
    }
    return;
  }

  // ── GET /api/schedule ─────────────────────────────────────────────────────
  if (req.method === "GET" && path === "/api/schedule") {
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100);
    const result = await listScheduleEntriesByTenant({ tenantId: auth.tenantId, limit });
    if (result.mode === "no_database") {
      json(req, res, 503, { error: "database_required" });
      return;
    }
    if (result.mode === "error") {
      json(req, res, 500, { error: "db_error" });
      return;
    }
    json(req, res, 200, { entries: result.rows });
    return;
  }

  // ── POST /api/schedule ────────────────────────────────────────────────────
  if (req.method === "POST" && path === "/api/schedule") {
    let body: unknown;
    try {
      body = await readBody(req);
    } catch {
      json(req, res, 413, { error: "payload_too_large" });
      return;
    }
    if (typeof body !== "object" || body === null) {
      json(req, res, 400, { error: "invalid_body" });
      return;
    }
    const b = body as Record<string, unknown>;
    const result = await insertScheduleEntry({
      tenantId: auth.tenantId,
      scheduleEntryId: typeof b.scheduleEntryId === "string" ? b.scheduleEntryId : randomUUID(),
      campaignId: typeof b.campaignId === "string" ? b.campaignId : null,
      network: typeof b.network === "string" ? b.network : null,
      status: typeof b.status === "string" ? b.status : "scheduled",
      contentSummary: typeof b.contentSummary === "string" ? b.contentSummary : null,
      scheduledAt: typeof b.scheduledAt === "string" ? b.scheduledAt : null,
    });
    if (!result.ok) {
      if (result.code === "no_database") { json(req, res, 503, { error: "database_required" }); return; }
      if (result.code === "duplicate") { json(req, res, 409, { error: "duplicate_entry" }); return; }
      json(req, res, 500, { error: "db_error" });
      return;
    }
    json(req, res, 201, { entry: result.row });
    return;
  }

  // ── GET /api/brand-profile ────────────────────────────────────────────────
  if (req.method === "GET" && path === "/api/brand-profile") {
    const params = new URLSearchParams({ tenantId: auth.tenantId, profileId: auth.tenantId });
    const outcome = await executeGetBrandProfileRequestFromSearchParams(params);
    json(req, res, outcome.status, outcome.body);
    return;
  }

  // ── POST /api/brand-profile ───────────────────────────────────────────────
  if (req.method === "POST" && path === "/api/brand-profile") {
    let body: unknown;
    try {
      body = await readBody(req);
    } catch {
      json(req, res, 413, { error: "payload_too_large" });
      return;
    }
    const b = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const wrapped = { tenantId: auth.tenantId, profile: { ...(b as object), profileId: auth.tenantId } };
    const outcome = await executeUpsertBrandProfileRequest(wrapped);
    json(req, res, outcome.status, outcome.body);
    return;
  }

  // ── GET /api/analytics/summary ────────────────────────────────────────────
  if (req.method === "GET" && path === "/api/analytics/summary") {
    const summary = await getAnalyticsSummary(auth.tenantId);
    json(req, res, 200, summary);
    return;
  }

  json(req, res, 404, { error: "not_found" });
});

server.listen(port, host, () => {
  console.log(JSON.stringify({
    level: "info", event: "mvp_server_listen", host, port,
    frontend: FRONTEND_HTML_PATH,
    auth: !!process.env.MARKETER_JWT_SECRET,
    database: !!process.env.DATABASE_URL,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    openai: !!(process.env.MARKETER_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY),
  }));
});

async function shutdown(signal: string) {
  console.log(JSON.stringify({ level: "info", event: "mvp_shutdown", signal }));
  await new Promise<void>((r) => server.close(() => r()));
  await closePostgres().catch(() => {});
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => shutdown(sig).catch(() => process.exit(1)));
}
