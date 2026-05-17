/**
 * Phase 10 analytics HTTP routes.
 *
 * POST /analytics/refresh/:scheduleEntryId  — ingest metrics for one post
 * GET  /analytics                           — list snapshots
 * GET  /analytics/summary                   — aggregated metrics
 * GET  /analytics/:scheduleEntryId          — snapshots for one post
 *
 * Tenant header: X-Tenant-Id
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { AnalyticsNetwork } from "@home-link/marketer-pro-contract";
import { ingestAnalyticsForEntry } from "./analytics-ingest.js";
import { listAnalyticsSnapshots, getAnalyticsSummary } from "../db/analytics-snapshot.js";

function cors(res: ServerResponse): void {
  const origin = process.env.MARKETER_ANALYTICS_HTTP_CORS?.trim();
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

export async function handleAnalyticsRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const tenantId = (req.headers["x-tenant-id"] as string | undefined)?.trim();
  if (!tenantId) { json(res, 400, { error: "missing_tenant_id" }); return; }

  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname.replace(/\/+$/, "");

  // POST /analytics/refresh/:scheduleEntryId
  const refreshMatch = /^\/analytics\/refresh\/([^/]+)$/.exec(pathname);
  if (req.method === "POST" && refreshMatch) {
    const scheduleEntryId = refreshMatch[1]!;
    const result = await ingestAnalyticsForEntry(tenantId, scheduleEntryId);
    json(res, result.ok ? 200 : 422, result);
    return;
  }

  // GET /analytics/summary
  if (req.method === "GET" && pathname === "/analytics/summary") {
    const network = url.searchParams.get("network") as AnalyticsNetwork | null;
    const summary = await getAnalyticsSummary(tenantId, network ?? undefined);
    json(res, 200, { summary });
    return;
  }

  // GET /analytics/:scheduleEntryId
  const entryMatch = /^\/analytics\/([^/]+)$/.exec(pathname);
  if (req.method === "GET" && entryMatch) {
    const scheduleEntryId = entryMatch[1]!;
    const snapshots = await listAnalyticsSnapshots({ tenantId, scheduleEntryId });
    json(res, 200, { snapshots });
    return;
  }

  // GET /analytics
  if (req.method === "GET" && pathname === "/analytics") {
    const network = url.searchParams.get("network") ?? undefined;
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const snapshots = await listAnalyticsSnapshots({ tenantId, network, limit });
    json(res, 200, { snapshots });
    return;
  }

  json(res, 404, { error: "not_found" });
}
