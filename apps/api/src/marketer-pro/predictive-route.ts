/**
 * Phase 12 predictive scheduling HTTP routes.
 *
 * POST /schedule/predict           — generate recommendation
 * GET  /schedule/predict/:id       — get recommendation by id
 * GET  /schedule/best-times        — best slots for network (no DB)
 * GET  /schedule/history           — list recent recommendations
 * POST /schedule/apply/:id         — apply a slot to a recommendation
 *
 * Tenant header: X-Tenant-Id
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { PredictRequest, BestTimeSlot } from "@home-link/marketer-pro-contract";
import { predictBestTimes } from "../predictive/predict-best-time.js";
import { getStaticSlots, CONTENT_TYPE_MULTIPLIERS } from "../predictive/best-time-rules.js";
import {
  insertScheduleRecommendation,
  applyScheduleRecommendation,
  getLatestRecommendation,
  listRecommendations,
} from "../db/schedule-recommendation.js";

function cors(res: ServerResponse): void {
  const origin = process.env.MARKETER_PREDICTIVE_HTTP_CORS?.trim();
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-Tenant-Id,Authorization");
  }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", c => { data += c; });
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch { reject(new Error("invalid_json")); } });
    req.on("error", reject);
  });
}

export async function handlePredictiveRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const tenantId = (req.headers["x-tenant-id"] as string | undefined)?.trim();
  if (!tenantId) { json(res, 400, { error: "missing_tenant_id" }); return; }

  const url      = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname.replace(/\/+$/, "");

  // POST /schedule/predict
  if (req.method === "POST" && pathname === "/schedule/predict") {
    const body = await readBody(req) as PredictRequest;
    if (!body.network) { json(res, 400, { error: "network_required" }); return; }

    const slots = await predictBestTimes({
      tenantId,
      network: body.network,
      contentType: body.contentType,
      audienceTimezone: body.audienceTimezone,
    });

    const rec = await insertScheduleRecommendation({
      tenantId,
      scheduleEntryId: body.scheduleEntryId,
      network: body.network,
      contentType: body.contentType,
      audienceTimezone: body.audienceTimezone,
      topSlots: slots,
    });

    json(res, 200, { recommendation: rec ?? { topSlots: slots } });
    return;
  }

  // GET /schedule/best-times?network=&contentType=
  if (req.method === "GET" && pathname === "/schedule/best-times") {
    const network     = url.searchParams.get("network") ?? "generic";
    const contentType = url.searchParams.get("contentType") ?? undefined;
    const staticSlots = getStaticSlots(network);
    const mult        = contentType ? (CONTENT_TYPE_MULTIPLIERS[contentType]?.[network] ?? 1.0) : 1.0;

    const slots: BestTimeSlot[] = staticSlots.map(s => ({
      dayOfWeek:       s.dayOfWeek,
      hourUTC:         s.hourUTC,
      score:           Math.min(100, Math.round(s.baseScore * mult)),
      engagementScore: s.baseScore,
      reachScore:      s.baseScore,
      confidence:      "low" as const,
      reasons:         [s.reason],
    }));

    json(res, 200, { slots });
    return;
  }

  // GET /schedule/history
  if (req.method === "GET" && pathname === "/schedule/history") {
    const network = url.searchParams.get("network") ?? undefined;
    const limit   = Number(url.searchParams.get("limit") ?? "20");
    const recs    = await listRecommendations(tenantId, network, limit);
    json(res, 200, { recommendations: recs });
    return;
  }

  // GET /schedule/predict/:scheduleEntryId
  const getMatch = /^\/schedule\/predict\/([^/]+)$/.exec(pathname);
  if (req.method === "GET" && getMatch) {
    const scheduleEntryId = getMatch[1]!;
    const rec = await getLatestRecommendation(tenantId, scheduleEntryId);
    if (!rec) { json(res, 404, { error: "not_found" }); return; }
    json(res, 200, { recommendation: rec });
    return;
  }

  // POST /schedule/apply/:id
  const applyMatch = /^\/schedule\/apply\/([^/]+)$/.exec(pathname);
  if (req.method === "POST" && applyMatch) {
    const id   = applyMatch[1]!;
    const body = await readBody(req) as { slot?: BestTimeSlot };
    if (!body.slot) { json(res, 400, { error: "slot_required" }); return; }
    const rec  = await applyScheduleRecommendation(id, body.slot);
    if (!rec) { json(res, 404, { error: "not_found" }); return; }
    json(res, 200, { recommendation: rec });
    return;
  }

  json(res, 404, { error: "not_found" });
}
