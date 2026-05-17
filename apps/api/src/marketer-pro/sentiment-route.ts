/**
 * Phase 11 sentiment HTTP routes.
 *
 * POST /sentiment/refresh/:scheduleEntryId  — ingest + analyze comments
 * GET  /sentiment                           — list comments
 * GET  /sentiment/summary                   — aggregated sentiment
 * GET  /sentiment/:scheduleEntryId          — comments for one post
 *
 * Tenant header: X-Tenant-Id
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { ingestSentimentForEntry } from "./sentiment-ingest.js";
import { listSocialComments, getSentimentSummary } from "../db/social-comment.js";

function cors(res: ServerResponse): void {
  const origin = process.env.MARKETER_SENTIMENT_HTTP_CORS?.trim();
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

export async function handleSentimentRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const tenantId = (req.headers["x-tenant-id"] as string | undefined)?.trim();
  if (!tenantId) { json(res, 400, { error: "missing_tenant_id" }); return; }

  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname.replace(/\/+$/, "");

  // POST /sentiment/refresh/:scheduleEntryId
  const refreshMatch = /^\/sentiment\/refresh\/([^/]+)$/.exec(pathname);
  if (req.method === "POST" && refreshMatch) {
    const scheduleEntryId = refreshMatch[1]!;
    const result = await ingestSentimentForEntry(tenantId, scheduleEntryId);
    json(res, result.ok ? 200 : 422, result);
    return;
  }

  // GET /sentiment/summary
  if (req.method === "GET" && pathname === "/sentiment/summary") {
    const scheduleEntryId = url.searchParams.get("scheduleEntryId") ?? undefined;
    const network = url.searchParams.get("network") ?? undefined;
    const summary = await getSentimentSummary(tenantId, scheduleEntryId, network);
    json(res, 200, { summary });
    return;
  }

  // GET /sentiment/:scheduleEntryId
  const entryMatch = /^\/sentiment\/([^/]+)$/.exec(pathname);
  if (req.method === "GET" && entryMatch) {
    const scheduleEntryId = entryMatch[1]!;
    const comments = await listSocialComments({ tenantId, scheduleEntryId });
    json(res, 200, { comments });
    return;
  }

  // GET /sentiment
  if (req.method === "GET" && pathname === "/sentiment") {
    const network       = url.searchParams.get("network") ?? undefined;
    const sentimentScore = url.searchParams.get("sentiment") ?? undefined;
    const negativeOnly  = url.searchParams.get("negativeOnly") === "true";
    const brandSafetyOnly = url.searchParams.get("brandSafetyOnly") === "true";
    const limit         = Number(url.searchParams.get("limit") ?? "50");
    const comments = await listSocialComments({ tenantId, network, sentimentScore, negativeOnly, brandSafetyOnly, limit });
    json(res, 200, { comments });
    return;
  }

  json(res, 404, { error: "not_found" });
}
