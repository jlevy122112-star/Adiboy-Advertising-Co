/**
 * Phase 9 SERP brief HTTP routes.
 *
 * POST /serp-briefs          — generate a new SERP brief (async)
 * GET  /serp-briefs          — list past briefs for tenant
 * GET  /serp-briefs/:id      — get one brief
 *
 * Tenant header: X-Tenant-Id
 */

import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { fetchSerpResults } from "../serp/serp-provider.js";
import { generateSerpBrief } from "./serp-brief-generator.js";
import {
  insertSerpBrief,
  updateSerpBrief,
  getSerpBrief,
  listSerpBriefs,
} from "../db/serp-brief.js";

function cors(res: ServerResponse): void {
  const origin = process.env.MARKETER_SERP_HTTP_CORS?.trim();
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-Tenant-Id");
  }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { resolve({}); }
    });
    req.on("error", reject);
  });
}

const CreateSchema = z.object({
  keyword: z.string().min(1).max(500),
  network: z.string().optional(),
  industryVertical: z.string().optional(),
});

export async function handleSerpRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  cors(res);

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const tenantId = (req.headers["x-tenant-id"] as string | undefined)?.trim();
  if (!tenantId) { json(res, 400, { error: "missing_tenant_id" }); return; }

  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname.replace(/\/+$/, "");

  // POST /serp-briefs
  if (req.method === "POST" && pathname === "/serp-briefs") {
    const body = await readBody(req);
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      json(res, 400, { error: "invalid_body", issues: parsed.error.issues });
      return;
    }

    const id = randomUUID();
    const brief = await insertSerpBrief(id, tenantId, parsed.data.keyword);

    // Run async — respond immediately with pending brief
    void (async () => {
      try {
        await updateSerpBrief(id, tenantId, { status: "fetching" });

        const serpResult = await fetchSerpResults(parsed.data.keyword);
        if (!serpResult.ok) {
          await updateSerpBrief(id, tenantId, { status: "failed", error: serpResult.error });
          return;
        }

        await updateSerpBrief(id, tenantId, {
          status: "analyzing",
          serpJson: { results: serpResult.results, intent: undefined },
        });

        const analysis = await generateSerpBrief({
          keyword: parsed.data.keyword,
          results: serpResult.results,
          industryVertical: parsed.data.industryVertical,
          network: parsed.data.network,
        });

        await updateSerpBrief(id, tenantId, {
          status: "done",
          serpJson: { results: serpResult.results, intent: analysis.intent },
          analysisJson: {
            competitorAngles: analysis.competitorAngles,
            contentGaps: analysis.contentGaps,
            suggestedHeadline: analysis.suggestedHeadline,
            suggestedAngle: analysis.suggestedAngle,
            suggestedOutline: analysis.suggestedOutline,
            targetKeywords: analysis.targetKeywords,
            seoScore: analysis.seoScore,
            seoScoreReason: analysis.seoScoreReason,
          },
        });
      } catch (err) {
        await updateSerpBrief(id, tenantId, {
          status: "failed",
          error: err instanceof Error ? err.message : "unknown_error",
        });
      }
    })();

    json(res, 202, { brief });
    return;
  }

  // GET /serp-briefs
  if (req.method === "GET" && pathname === "/serp-briefs") {
    const limit = Number(url.searchParams.get("limit") ?? "20");
    const briefs = await listSerpBriefs(tenantId, limit);
    json(res, 200, { briefs });
    return;
  }

  // GET /serp-briefs/:id
  const getMatch = /^\/serp-briefs\/([^/]+)$/.exec(pathname);
  if (req.method === "GET" && getMatch) {
    const brief = await getSerpBrief(tenantId, getMatch[1]!);
    if (!brief) { json(res, 404, { error: "not_found" }); return; }
    json(res, 200, { brief });
    return;
  }

  json(res, 404, { error: "not_found" });
}
