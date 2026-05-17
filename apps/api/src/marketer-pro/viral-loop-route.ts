import type { IncomingMessage, ServerResponse } from "node:http";
import { requireAuth, securityHeaders, getClientIp } from "./auth/middleware.js";
import {
  insertViralShare,
  getViralShare,
  incrementShareView,
  recordViralSignup,
  recordTemplateClone,
  getViralMetrics,
} from "../db/viral-loop.js";

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

const CORS_ORIGIN = process.env.MARKETER_VIRAL_HTTP_CORS?.trim() ?? "*";

function corsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

export async function handleViralLoopRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  securityHeaders(res);
  corsHeaders(res);

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname.replace(/\/+$/, "");
  const ip = getClientIp(req);

  // POST /viral/track-share — create a share link
  if (req.method === "POST" && pathname === "/viral/track-share") {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const body = await readBody(req) as Record<string, unknown>;
    const shareType = String(body["shareType"] ?? "");
    const channel = String(body["channel"] ?? "link");

    if (!["campaign", "post", "template", "competitor_report"].includes(shareType)) {
      json(res, 400, { error: "invalid_share_type" }); return;
    }

    const share = await insertViralShare({
      tenantId: auth.tenantId,
      shareType,
      channel,
      sharedBy: auth.userId,
      campaignId: body["campaignId"] as string | undefined,
      postId: body["postId"] as string | undefined,
      templateId: body["templateId"] as string | undefined,
      reportId: body["reportId"] as string | undefined,
      brandingVisible: body["brandingVisible"] !== false,
    });

    if (!share) { json(res, 500, { error: "db_error" }); return; }

    const baseUrl = process.env.MARKETER_PUBLIC_URL?.trim() ?? "https://app.marketerpro.io";
    json(res, 201, {
      shareToken: share.share_token,
      shareUrl: `${baseUrl}/s/${share.share_token}`,
    });
    return;
  }

  // POST /viral/track-signup — record a viral signup from a share
  if (req.method === "POST" && pathname === "/viral/track-signup") {
    const body = await readBody(req) as Record<string, unknown>;
    const shareToken = String(body["shareToken"] ?? "");
    const refereeId = body["refereeId"] as string | undefined;

    if (!shareToken) { json(res, 400, { error: "missing_share_token" }); return; }

    const recorded = await recordViralSignup({ shareToken, refereeId, ip });
    json(res, 200, { recorded });
    return;
  }

  // POST /viral/track-clone — record template clone
  if (req.method === "POST" && pathname === "/viral/track-clone") {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const body = await readBody(req) as Record<string, unknown>;
    const templateId = String(body["templateId"] ?? "");
    const sourceToken = body["sourceToken"] as string | undefined;

    if (!templateId) { json(res, 400, { error: "missing_template_id" }); return; }

    const clone = await recordTemplateClone({
      templateId,
      clonedBy: auth.userId,
      tenantId: auth.tenantId,
      sourceToken,
    });

    json(res, 201, { clone });
    return;
  }

  // GET /viral/metrics — viral dashboard data
  if (req.method === "GET" && pathname === "/viral/metrics") {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const days = Math.min(Number(url.searchParams.get("days") ?? "30"), 90);
    const metrics = await getViralMetrics(auth.tenantId, days);
    json(res, 200, { metrics, windowDays: days });
    return;
  }

  // GET /viral/share/:token — get share metadata (public, increments view)
  const shareMatch = pathname.match(/^\/viral\/share\/([^/]+)$/);
  if (req.method === "GET" && shareMatch) {
    const shareToken = shareMatch[1]!;
    const share = await getViralShare(shareToken);
    if (!share) { json(res, 404, { error: "not_found" }); return; }

    await incrementShareView(shareToken);
    json(res, 200, {
      shareType: share.share_type,
      campaignId: share.campaign_id,
      postId: share.post_id,
      templateId: share.template_id,
      reportId: share.report_id,
      brandingVisible: share.branding_visible,
    });
    return;
  }

  json(res, 404, { error: "not_found" });
}
