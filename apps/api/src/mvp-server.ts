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
 *   STRIPE_SECRET_KEY          optional — Stripe billing
 *   STRIPE_WEBHOOK_SECRET      optional — Stripe webhook verification
 *   STRIPE_PRICE_PRO_MONTHLY   optional — Stripe price ID
 *   STRIPE_PRICE_PRO_ANNUAL    optional — Stripe price ID
 *   STRIPE_PRICE_ENT_MONTHLY   optional — Stripe price ID
 *   STRIPE_PRICE_ENT_ANNUAL    optional — Stripe price ID
 *   APP_URL                    optional — frontend URL for Stripe redirects (default http://localhost:8780)
 *   X_CLIENT_ID / X_CLIENT_SECRET
 *   META_APP_ID / META_APP_SECRET
 *   LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET
 *   YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET
 *   TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET
 *   MARKETER_FRONTEND_URL      optional — OAuth callback redirect base (default http://localhost:8780)
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import { closePostgres } from "./db/postgres.js";
import { requireAuth, securityHeaders, getClientIp } from "./marketer-pro/auth/middleware.js";
import { handleAuthRequest } from "./marketer-pro/auth-route.js";
import { handleBillingRequest } from "./marketer-pro/billing-route.js";
import { globalRateLimit, publishRateLimit, generateRateLimit } from "./marketer-pro/auth/rate-limit.js";
import { applyRequestId, IdempotencyStore, assertTenantMatch, safeLogCtx, TenantMismatchError } from "./marketer-pro/security.js";
import { handleSocialOAuthRequest } from "./marketer-pro/social-oauth-route.js";
import {
  executeUpsertBrandProfileRequest,
  executeGetBrandProfileRequestFromSearchParams,
} from "./marketer-pro/brand-profile-route.js";
import {
  insertScheduleEntry,
  listScheduleEntriesByTenant,
  updateScheduleEntryFields,
  deleteScheduleEntry,
} from "./db/schedule-entry.js";
import { getMvpBrandConfig, upsertMvpBrandConfig } from "./db/brand-profile.js";
import { getAnalyticsSummary } from "./db/analytics-snapshot.js";
import { marketerEntitlementsForPlan } from "@home-link/marketer-pro-contract";
import { getWorkspacePlan } from "./db/workspace-billing.js";
import { generatePosts, type GeneratePostsInput } from "./marketer-pro/mvp-generate-posts.js";
import { generateVideoScripts, generateImages } from "./marketer-pro/mvp-generate-assets.js";
import { startAutonomousRun, applyUserAction } from "./marketer-pro/autonomous-orchestrator.js";
import { getAutonomousRun, listAutonomousRuns } from "./db/autonomous-run.js";
import { DEFAULT_AUTONOMY_POLICY, runProgress } from "@home-link/marketer-pro-contract";
import { publishAll, type MvpPublishInput } from "./marketer-pro/mvp-publisher.js";
import { createDeletionRequest, getDeletionRequest, cancelDeletionRequest } from "./db/account-deletion.js";
import { handleSsoRequest } from "./marketer-pro/sso-route.js";
import { getPostgresClient } from "./db/postgres.js";
import {
  getTenantUsage,
  incrementAiGenerations,
  incrementPostsPublished,
  incrementAssetsStored,
  PLAN_USAGE_LIMITS,
} from "./db/tenant-usage.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRONTEND_HTML_PATH = join(__dirname, "../../marketer-pro-mobile/index.html");
const MAX_BODY = 256 * 1024;

// Publish idempotency: keyed by `tenantId:Idempotency-Key`, 24-hour TTL.
const publishIdempotency = new IdempotencyStore<unknown>(86_400_000).startCleanup();

const host = process.env.MVP_HOST ?? "0.0.0.0";
const port = Number(process.env.MVP_PORT ?? 8780);

// Default APP_URL and MARKETER_FRONTEND_URL to this server so OAuth + Stripe redirects work
if (!process.env.APP_URL) process.env.APP_URL = `http://localhost:${port}`;
if (!process.env.MARKETER_FRONTEND_URL) process.env.MARKETER_FRONTEND_URL = `http://localhost:${port}`;

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
    const str = (k: string) => typeof b[k] === "string" && b[k] ? String(b[k]) : undefined;
    return {
      platforms: (b.platforms as unknown[]).filter((p): p is string => typeof p === "string"),
      topic: String(b.topic),
      contentGoal: str("contentGoal") ?? "Build brand awareness",
      cta: str("cta") ?? "Learn more",
      hashtagStrategy: str("hashtagStrategy") ?? "Broad reach (10–15 hashtags)",
      urgency: str("urgency") ?? "Normal",
      // brand fields from client (supplemented server-side from DB below)
      brandName: str("brandName"),
      brandVoice: str("brandVoice"),
      brandColor: str("brandColor"),
      businessType: str("businessType"),
      industry: str("industry"),
      problem: str("problem"),
      solution: str("solution"),
      outcome: str("outcome"),
      website: str("website"),
      phone: str("phone"),
      contactEmail: str("contactEmail"),
      instagramHandle: str("instagramHandle"),
      address: str("address"),
    };
  },
};

const server = createServer(async (req, res) => {
  securityHeaders(res);
  const requestId = applyRequestId(req, res);

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

  // ── Global IP rate limit (exempt: webhook, static assets, OPTIONS) ─────────
  if (path !== "/billing/webhook" && req.method !== "OPTIONS") {
    const ip = getClientIp(req);
    const rl = globalRateLimit(ip);
    if (!rl.allowed) {
      res.setHeader("Retry-After", String(Math.ceil((rl.resetAt - Date.now()) / 1000)));
      json(req, res, 429, { error: "too_many_requests", requestId });
      return;
    }
  }

  // ── Serve frontend ────────────────────────────────────────────────────────
  if (req.method === "GET" && (path === "/" || path === "/index.html")) {
    serveFrontend(res);
    return;
  }

  // ── Health check (no auth, for uptime monitors) ───────────────────────────
  if (req.method === "GET" && path === "/health") {
    const sql = getPostgresClient();
    let dbOk = false;
    if (sql) {
      try { await sql`SELECT 1`; dbOk = true; } catch { /* db unavailable */ }
    }
    const status = dbOk ? 200 : 503;
    json(req, res, status, { ok: dbOk, ts: new Date().toISOString(), version: process.env.npm_package_version ?? "unknown" });
    return;
  }

  // ── SSO routes — Google/Apple (no JWT, handles own redirects) ───────────────
  if (path.startsWith("/auth/sso/")) {
    const handled = await handleSsoRequest(req, res);
    if (handled) return;
  }

  // ── Auth routes (no JWT required) ─────────────────────────────────────────
  if (path.startsWith("/auth/")) {
    await handleAuthRequest(req, res);
    return;
  }

  // ── Stripe webhook (no JWT — raw body needed, verified by Stripe signature) ─
  if (req.method === "POST" && path === "/billing/webhook") {
    await handleBillingRequest(req, res);
    return;
  }

  // ── OAuth callback (no JWT — browser redirect from social platform) ─────────
  if (req.method === "GET" && path.startsWith("/oauth/callback/")) {
    await handleSocialOAuthRequest(req, res);
    return;
  }

  // ── Billing routes (JWT required, handled by billing-route.ts) ──────────────
  if (path.startsWith("/billing/")) {
    await handleBillingRequest(req, res);
    return;
  }

  // ── Social OAuth routes (JWT required) ──────────────────────────────────────
  if (path.startsWith("/oauth/")) {
    await handleSocialOAuthRequest(req, res);
    return;
  }

  // ── SPA catch-all: serve frontend for any remaining GET (e.g. /connections after OAuth redirect) ─
  if (req.method === "GET") {
    serveFrontend(res);
    return;
  }

  // ── All /api/* routes require JWT ─────────────────────────────────────────
  if (!path.startsWith("/api/")) {
    json(req, res, 404, { error: "not_found" });
    return;
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;

  // ── GET /api/plan ─────────────────────────────────────────────────────────
  if (req.method === "GET" && path === "/api/plan") {
    const plan = await getWorkspacePlan(auth.tenantId) ?? "free";
    const entitlements = marketerEntitlementsForPlan(plan as "free" | "pro" | "enterprise");
    json(req, res, 200, { plan, entitlements });
    return;
  }

  // ── POST /api/generate ────────────────────────────────────────────────────
  if (req.method === "POST" && path === "/api/generate") {
    const plan = await getWorkspacePlan(auth.tenantId) ?? "free";
    const ent = marketerEntitlementsForPlan(plan as "free" | "pro" | "enterprise");
    if (!ent.canUseAiGenerate) {
      json(req, res, 403, { error: "plan_required", plan, message: "Upgrade to Pro to use AI generation." });
      return;
    }
    const genRl = generateRateLimit(auth.tenantId);
    if (!genRl.allowed) {
      res.setHeader("Retry-After", String(Math.ceil((genRl.resetAt - Date.now()) / 1000)));
      json(req, res, 429, { error: "generation_rate_limit", message: "Too many generation requests. Try again later.", requestId });
      return;
    }
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
    // Server-side brand injection — DB is authoritative; client fields are fallback
    const dbBrand = await getMvpBrandConfig(auth.tenantId);
    const brandedInput: GeneratePostsInput = {
      ...input,
      brandName:      dbBrand?.brandName      ?? input.brandName,
      brandVoice:     dbBrand?.brandWords     ?? input.brandVoice,
      brandColor:     dbBrand?.brandColor     ?? input.brandColor,
      businessType:   dbBrand?.businessType   ?? input.businessType,
      industry:       dbBrand?.industry       ?? input.industry,
      problem:        dbBrand?.problem        ?? input.problem,
      solution:       dbBrand?.solution       ?? input.solution,
      outcome:        dbBrand?.outcome        ?? input.outcome,
      website:        dbBrand?.website        ?? input.website,
      phone:          dbBrand?.phone          ?? input.phone,
      contactEmail:   dbBrand?.email          ?? input.contactEmail,
      instagramHandle: dbBrand?.instagram     ?? input.instagramHandle,
      address:        dbBrand?.address        ?? input.address,
    };
    try {
      const [posts, videoScripts] = await Promise.all([
        generatePosts(brandedInput),
        generateVideoScripts(brandedInput),
      ]);
      // Track AI usage (fire-and-forget)
      incrementAiGenerations(auth.tenantId, posts.length || 1).catch(() => {});
      json(req, res, 200, { posts, videoScripts });
    } catch (err) {
      console.error(JSON.stringify(safeLogCtx({ level: "error", event: "mvp_generate_error", tenantId: auth.tenantId, requestId, message: String(err) })));
      json(req, res, 500, { error: "generation_failed", requestId });
    }
    return;
  }

  // ── POST /api/generate-images ─────────────────────────────────────────────
  if (req.method === "POST" && path === "/api/generate-images") {
    const plan = await getWorkspacePlan(auth.tenantId) ?? "free";
    const ent = marketerEntitlementsForPlan(plan as "free" | "pro" | "enterprise");
    if (!ent.canUseAiGenerate) {
      json(req, res, 403, { error: "plan_required", plan, message: "Upgrade to Pro to generate images." });
      return;
    }
    const imgGenRl = generateRateLimit(auth.tenantId);
    if (!imgGenRl.allowed) {
      res.setHeader("Retry-After", String(Math.ceil((imgGenRl.resetAt - Date.now()) / 1000)));
      json(req, res, 429, { error: "generation_rate_limit", message: "Too many generation requests. Try again later.", requestId });
      return;
    }
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
    const dbBrand = await getMvpBrandConfig(auth.tenantId);
    const brandedInput: GeneratePostsInput = {
      ...input,
      brandName:       dbBrand?.brandName      ?? input.brandName,
      brandVoice:      dbBrand?.brandWords     ?? input.brandVoice,
      brandColor:      dbBrand?.brandColor     ?? input.brandColor,
      businessType:    dbBrand?.businessType   ?? input.businessType,
      industry:        dbBrand?.industry       ?? input.industry,
      problem:         dbBrand?.problem        ?? input.problem,
      solution:        dbBrand?.solution       ?? input.solution,
      outcome:         dbBrand?.outcome        ?? input.outcome,
      website:         dbBrand?.website        ?? input.website,
      phone:           dbBrand?.phone          ?? input.phone,
      contactEmail:    dbBrand?.email          ?? input.contactEmail,
      instagramHandle: dbBrand?.instagram      ?? input.instagramHandle,
      address:         dbBrand?.address        ?? input.address,
    };
    try {
      const images = await generateImages(brandedInput);
      // Track AI image generation + asset count (fire-and-forget)
      incrementAiGenerations(auth.tenantId, images.length || 1).catch(() => {});
      incrementAssetsStored(auth.tenantId, images.length || 1).catch(() => {});
      json(req, res, 200, { images });
    } catch (err) {
      console.error(JSON.stringify(safeLogCtx({ level: "error", event: "mvp_generate_images_error", tenantId: auth.tenantId, requestId, message: String(err) })));
      json(req, res, 500, { error: "generation_failed", requestId });
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

  // ── PATCH /api/schedule/:id — reschedule or update fields ─────────────────
  if (req.method === "PATCH" && path.startsWith("/api/schedule/")) {
    const entryId = path.slice("/api/schedule/".length);
    if (!entryId) { json(req, res, 400, { error: "missing_id" }); return; }
    let body: unknown;
    try { body = await readBody(req); } catch { json(req, res, 413, { error: "payload_too_large" }); return; }
    const b = (typeof body === "object" && body !== null) ? body as Record<string, unknown> : {};
    const result = await updateScheduleEntryFields({
      tenantId: auth.tenantId,
      scheduleEntryId: entryId,
      contentSummary: typeof b.contentSummary === "string" ? b.contentSummary : null,
      network: typeof b.network === "string" ? b.network : null,
      scheduledAt: typeof b.scheduledAt === "string" ? b.scheduledAt : null,
      videoOptions: null,
      metadata: null,
    });
    if (!result.ok) {
      if (result.code === "no_database") { json(req, res, 503, { error: "database_required" }); return; }
      if (result.code === "not_found") { json(req, res, 404, { error: "not_found" }); return; }
      json(req, res, 500, { error: "db_error" }); return;
    }
    json(req, res, 200, { entry: result.row });
    return;
  }

  // ── DELETE /api/schedule/:id ──────────────────────────────────────────────
  if (req.method === "DELETE" && path.startsWith("/api/schedule/")) {
    const entryId = path.slice("/api/schedule/".length);
    if (!entryId) { json(req, res, 400, { error: "missing_id" }); return; }
    const result = await deleteScheduleEntry({ tenantId: auth.tenantId, scheduleEntryId: entryId });
    if (!result.ok) {
      if (result.code === "no_database") { json(req, res, 503, { error: "database_required" }); return; }
      if (result.code === "not_found") { json(req, res, 404, { error: "not_found" }); return; }
      json(req, res, 500, { error: "db_error" }); return;
    }
    json(req, res, 200, { deleted: true });
    return;
  }

  // ── GET /api/brand-profile ────────────────────────────────────────────────
  if (req.method === "GET" && path === "/api/brand-profile") {
    const config = await getMvpBrandConfig(auth.tenantId);
    if (!config) {
      json(req, res, 404, { error: "not_found" });
      return;
    }
    json(req, res, 200, { profile: config });
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
    // Persist MVP brand config directly (bypasses complex BrandIntelligenceProfileSchema)
    const result = await upsertMvpBrandConfig(auth.tenantId, b);
    if (!result.ok) {
      if (result.reason === "no_database") {
        json(req, res, 503, { error: "database_required" });
        return;
      }
      json(req, res, 500, { error: "db_error" });
      return;
    }
    json(req, res, 200, { profile: { ...b, profileId: auth.tenantId } });
    return;
  }

  // ── GET /api/usage — tenant usage vs plan limits ─────────────────────────
  if (req.method === "GET" && path === "/api/usage") {
    const plan = (await getWorkspacePlan(auth.tenantId)) ?? "free";
    const [usage] = await Promise.all([getTenantUsage(auth.tenantId)]);
    const limits = PLAN_USAGE_LIMITS[plan] ?? PLAN_USAGE_LIMITS["free"]!;
    const aiUsed = usage ? Number(usage.ai_generations) : 0;
    const postsUsed = usage ? Number(usage.posts_published) : 0;
    const storageMb = usage ? Math.round(Number(usage.storage_bytes) / 1_048_576) : 0;
    json(req, res, 200, {
      plan,
      periodStart: usage?.period_start ?? new Date().toISOString(),
      metrics: {
        aiGenerations:  { used: aiUsed,    limit: limits.aiGenerations,  unit: "generations" },
        postsPublished: { used: postsUsed, limit: limits.postsPublished, unit: "posts" },
        storageUsedMb:  { used: storageMb, limit: limits.storageMb,      unit: "MB" },
        assetsStored:   { used: usage ? Number(usage.assets_stored) : 0, limit: null, unit: "assets" },
      },
    });
    return;
  }

  // ── GET /api/analytics/summary ────────────────────────────────────────────
  if (req.method === "GET" && path === "/api/analytics/summary") {
    const summary = await getAnalyticsSummary(auth.tenantId);
    json(req, res, 200, summary);
    return;
  }

  // ── GET /api/analytics/by-network ─────────────────────────────────────────
  // Returns per-network engagement rates for the bar chart.
  if (req.method === "GET" && path === "/api/analytics/by-network") {
    const networks = ["ig", "li", "fb", "x", "tt", "yt", "pin"] as const;
    const results = await Promise.all(
      networks.map(async (n) => {
        const s = await getAnalyticsSummary(auth.tenantId, n as Parameters<typeof getAnalyticsSummary>[1]);
        return { network: n, engagementRate: s.avgEngagementRate, snapshotCount: s.snapshotCount };
      }),
    );
    json(req, res, 200, { networks: results.filter(r => r.snapshotCount > 0) });
    return;
  }

  // ── POST /api/autonomous/start ────────────────────────────────────────────
  if (req.method === "POST" && path === "/api/autonomous/start") {
    const plan = await getWorkspacePlan(auth.tenantId) ?? "free";
    const ent = marketerEntitlementsForPlan(plan as "free" | "pro" | "enterprise");
    if (!ent.canUseAutonomousMode) {
      json(req, res, 403, { error: "plan_required", message: "Autonomous mode requires Pro or Enterprise." });
      return;
    }
    let body: unknown;
    try { body = await readBody(req); } catch {
      json(req, res, 413, { error: "payload_too_large" }); return;
    }
    const b = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const platforms = Array.isArray(b.platforms) && b.platforms.length
      ? (b.platforms as unknown[]).filter((p): p is string => typeof p === "string")
      : ["ig", "li", "fb", "x", "tt"];
    const scope = b.scope === "full_campaign" ? "full_campaign" : "single_post";
    const seedPrompt = typeof b.seedPrompt === "string" ? b.seedPrompt.slice(0, 8000) : undefined;
    const targetPostCount = scope === "full_campaign"
      ? Math.min(Math.max(1, Number(b.targetPostCount ?? 5)), 10)
      : 1;

    const brand = await getMvpBrandConfig(auth.tenantId);
    const policy = { ...DEFAULT_AUTONOMY_POLICY, mode: "autonomous" as const };

    const run = await startAutonomousRun({
      tenantId: auth.tenantId,
      request: {
        workspaceId: auth.tenantId,
        requestedByUserId: auth.tenantId,
        platforms: platforms as "instagram"[],
        scope,
        seedPrompt,
        targetPostCount,
      },
      policy,
      brand,
    });
    if (!run) {
      json(req, res, 503, { error: "database_required" }); return;
    }
    json(req, res, 201, { run: { runId: run.runId, state: run.state, progress: runProgress(run) } });
    return;
  }

  // ── GET /api/autonomous/runs ──────────────────────────────────────────────
  if (req.method === "GET" && path === "/api/autonomous/runs") {
    const state = url.searchParams.get("state") ?? undefined;
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 50);
    const runs = await listAutonomousRuns(auth.tenantId, state, limit);
    json(req, res, 200, {
      runs: runs.map(r => ({ runId: r.runId, state: r.state, progress: runProgress(r),
        platforms: r.request.platforms, scope: r.request.scope,
        createdAt: r.createdAt, updatedAt: r.updatedAt,
        failureKind: r.failureKind ?? undefined })),
    });
    return;
  }

  // ── GET /api/autonomous/runs/:runId ───────────────────────────────────────
  if (req.method === "GET" && path.startsWith("/api/autonomous/runs/") && path.split("/").length === 5) {
    const runId = path.split("/")[4];
    if (!runId) { json(req, res, 400, { error: "missing_run_id" }); return; }
    const run = await getAutonomousRun(runId);
    if (!run) { json(req, res, 404, { error: "not_found" }); return; }
    try { assertTenantMatch(run.workspaceId, auth.tenantId); } catch {
      // Return 404 so callers can't probe for run IDs belonging to other tenants
      json(req, res, 404, { error: "not_found" }); return;
    }
    json(req, res, 200, { run: { ...run, progress: runProgress(run) } });
    return;
  }

  // ── POST /api/autonomous/runs/:runId/:action ───────────────────────────────
  if (req.method === "POST" && path.startsWith("/api/autonomous/runs/")) {
    const parts = path.split("/");
    const runId = parts[4];
    const action = parts[5] as "cancel" | "pause" | "resume" | undefined;
    if (!runId || !action || !["cancel", "pause", "resume"].includes(action)) {
      json(req, res, 400, { error: "invalid_request" }); return;
    }
    const run = await getAutonomousRun(runId);
    if (!run) { json(req, res, 404, { error: "not_found" }); return; }
    try { assertTenantMatch(run.workspaceId, auth.tenantId); } catch {
      json(req, res, 404, { error: "not_found" }); return;
    }
    const updated = await applyUserAction(run, action, auth.tenantId);
    json(req, res, 200, { run: { runId: updated.runId, state: updated.state, progress: runProgress(updated) } });
    return;
  }

  // ── POST /api/publish ─────────────────────────────────────────────────────
  if (req.method === "POST" && path === "/api/publish") {
    const plan = await getWorkspacePlan(auth.tenantId) ?? "free";
    const ent = marketerEntitlementsForPlan(plan as "free" | "pro" | "enterprise");
    if (!ent.canUseAiGenerate) {
      json(req, res, 403, { error: "plan_required", message: "Upgrade to Pro to publish." });
      return;
    }

    // Per-tenant publish rate limit — prevent accidental double-publish storms
    const pubRl = publishRateLimit(auth.tenantId);
    if (!pubRl.allowed) {
      res.setHeader("Retry-After", String(Math.ceil((pubRl.resetAt - Date.now()) / 1000)));
      json(req, res, 429, { error: "publish_rate_limit", message: "Too many publish requests. Wait before retrying.", requestId });
      return;
    }

    // Idempotency-Key: same key + same tenant returns cached result without re-publishing
    const idempotencyKey = req.headers["idempotency-key"];
    if (typeof idempotencyKey === "string" && idempotencyKey.trim()) {
      const cacheKey = `${auth.tenantId}:${idempotencyKey.trim()}`;
      const cached = publishIdempotency.get(cacheKey);
      if (cached !== undefined) {
        res.setHeader("Idempotent-Replayed", "true");
        json(req, res, 200, cached);
        return;
      }
    }

    let body: unknown;
    try { body = await readBody(req); } catch {
      json(req, res, 413, { error: "payload_too_large" }); return;
    }
    const b = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const rawPosts = Array.isArray(b.posts) ? b.posts : [];
    const posts: MvpPublishInput[] = rawPosts.flatMap((p): MvpPublishInput[] => {
      if (typeof p !== "object" || p === null) return [];
      const post = p as Record<string, unknown>;
      const platform = String(post.platform ?? "");
      if (!["ig", "fb", "x", "li", "tt"].includes(platform)) return [];
      return [{
        platform: platform as MvpPublishInput["platform"],
        content: String(post.content ?? ""),
        imageUrl: typeof post.imageUrl === "string" ? post.imageUrl : undefined,
        hashtags: Array.isArray(post.hashtags) ? post.hashtags.map(String) : undefined,
        topic: typeof post.topic === "string" ? post.topic : undefined,
        altText: typeof post.altText === "string" ? post.altText : undefined,
      }];
    });
    if (!posts.length) {
      json(req, res, 400, { error: "validation_error", message: "posts[] is required with at least one valid entry" });
      return;
    }
    try {
      const results = await publishAll(auth.tenantId, posts);
      const allOk = results.every(r => r.ok);
      // Track successful publishes (fire-and-forget)
      const successCount = results.filter(r => r.ok).length;
      if (successCount > 0) incrementPostsPublished(auth.tenantId, successCount).catch(() => {});
      const responseBody = { results };

      // Cache result under idempotency key for replay protection
      if (typeof idempotencyKey === "string" && idempotencyKey.trim()) {
        const cacheKey = `${auth.tenantId}:${idempotencyKey.trim()}`;
        publishIdempotency.set(cacheKey, responseBody);
      }

      json(req, res, allOk ? 200 : 207, responseBody);
    } catch (e) {
      console.error(JSON.stringify(safeLogCtx({ level: "error", event: "mvp_publish_error", tenantId: auth.tenantId, requestId, message: String(e) })));
      json(req, res, 500, { error: "publish_failed", requestId });
    }
    return;
  }

  // ── GET /api/account/export — GDPR data export ───────────────────────────
  if (req.method === "GET" && path === "/api/account/export") {
    const sql = getPostgresClient();
    if (!sql) { json(req, res, 503, { error: "database_unavailable" }); return; }
    try {
      const [scheduleRows, brandRows, runRows] = await Promise.all([
        sql`SELECT id, network, status, content_summary, scheduled_at, created_at FROM schedule_entries WHERE tenant_id = ${auth.tenantId} ORDER BY created_at DESC LIMIT 1000`,
        sql`SELECT id, profile_json, created_at, updated_at FROM brand_profiles WHERE tenant_id = ${auth.tenantId} LIMIT 1`,
        sql`SELECT run_id, state, created_at, updated_at FROM autonomous_runs WHERE workspace_id = ${auth.tenantId} ORDER BY created_at DESC LIMIT 100`,
      ]);
      const payload = JSON.stringify({
        exportedAt: new Date().toISOString(),
        tenantId: auth.tenantId,
        userId: auth.userId,
        scheduledPosts: scheduleRows,
        brandProfile: brandRows[0] ?? null,
        autonomousRuns: runRows,
      }, null, 2);
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="marketer-pro-export-${new Date().toISOString().slice(0,10)}.json"`,
        "Content-Length": Buffer.byteLength(payload),
      });
      res.end(payload);
    } catch (e) {
      json(req, res, 500, { error: "export_failed", requestId });
    }
    return;
  }

  // ── POST /api/account/delete-request — GDPR account deletion ─────────────
  if (req.method === "POST" && path === "/api/account/delete-request") {
    const result = await createDeletionRequest({
      workspaceId: auth.tenantId,
      requestedByUserId: auth.userId,
      scheduleDelayHours: 72, // 72-hour grace period
    });
    if (!result) { json(req, res, 500, { error: "deletion_request_failed" }); return; }
    json(req, res, 201, result);
    return;
  }

  // ── GET /api/account/delete-request ──────────────────────────────────────
  if (req.method === "GET" && path === "/api/account/delete-request") {
    const result = await getDeletionRequest(auth.tenantId);
    if (!result) { json(req, res, 404, { error: "no_pending_deletion" }); return; }
    json(req, res, 200, result);
    return;
  }

  // ── DELETE /api/account/delete-request — cancel pending deletion ──────────
  if (req.method === "DELETE" && path === "/api/account/delete-request") {
    await cancelDeletionRequest(auth.tenantId);
    json(req, res, 200, { cancelled: true });
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
    stripe: !!process.env.STRIPE_SECRET_KEY,
    oauth_meta: !!process.env.META_APP_ID,
    oauth_x: !!process.env.X_CLIENT_ID,
    oauth_linkedin: !!process.env.LINKEDIN_CLIENT_ID,
    oauth_youtube: !!process.env.YOUTUBE_CLIENT_ID,
    oauth_tiktok: !!process.env.TIKTOK_CLIENT_KEY,
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
