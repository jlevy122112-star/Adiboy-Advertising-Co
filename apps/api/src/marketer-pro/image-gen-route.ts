/**
 * Phase 6 image generation HTTP routes.
 *
 * POST   /generate          — trigger image generation from a brief
 * GET    /asset/:id         — get asset status / URL
 * GET    /assets            — list assets (by scheduleEntryId or briefId query param)
 * POST   /asset/:id/approve — mark approved
 * POST   /asset/:id/reject  — mark rejected
 *
 * Tenant header: X-Tenant-Id (required on all routes)
 * CORS:          MARKETER_IMAGE_GEN_HTTP_CORS env var
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { GenerationBriefSchema } from "@home-link/marketer-pro-contract";
import { generateImage } from "./image-generate.js";
import {
  getGeneratedAsset,
  listGeneratedAssets,
  updateGeneratedAsset,
} from "../db/generated-asset.js";

function cors(res: ServerResponse): void {
  const origin = process.env.MARKETER_IMAGE_GEN_HTTP_CORS?.trim();
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-Tenant-Id");
  }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

const GenerateBodySchema = z.object({
  brief: GenerationBriefSchema,
  network: z.string().optional(),
  scheduleEntryId: z.string().optional(),
  quality: z.enum(["standard", "hd"]).optional(),
});

export async function handleImageGenRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  cors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const tenantId = (req.headers["x-tenant-id"] as string | undefined)?.trim();
  if (!tenantId) {
    json(res, 400, { error: "missing_tenant_id" });
    return;
  }

  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname.replace(/\/+$/, "");

  // POST /generate
  if (req.method === "POST" && pathname === "/generate") {
    const body = await readBody(req);
    const parsed = GenerateBodySchema.safeParse(body);
    if (!parsed.success) {
      json(res, 400, { error: "invalid_body", issues: parsed.error.issues });
      return;
    }
    const result = await generateImage({
      tenantId,
      brief: parsed.data.brief,
      network: parsed.data.network,
      scheduleEntryId: parsed.data.scheduleEntryId,
      quality: parsed.data.quality,
    });
    json(res, result.ok ? 200 : 422, result);
    return;
  }

  // GET /assets
  if (req.method === "GET" && pathname === "/assets") {
    const scheduleEntryId = url.searchParams.get("scheduleEntryId") ?? undefined;
    const briefId = url.searchParams.get("briefId") ?? undefined;
    const limit = Number(url.searchParams.get("limit") ?? "20");
    const rows = await listGeneratedAssets({ tenantId, scheduleEntryId, briefId, limit });
    json(res, 200, { assets: rows });
    return;
  }

  // GET /asset/:id
  const assetGetMatch = /^\/asset\/([^/]+)$/.exec(pathname);
  if (req.method === "GET" && assetGetMatch) {
    const id = assetGetMatch[1]!;
    const asset = await getGeneratedAsset(tenantId, id);
    if (!asset) {
      json(res, 404, { error: "asset_not_found" });
      return;
    }
    json(res, 200, { asset });
    return;
  }

  // POST /asset/:id/approve
  const approveMatch = /^\/asset\/([^/]+)\/approve$/.exec(pathname);
  if (req.method === "POST" && approveMatch) {
    const id = approveMatch[1]!;
    const asset = await updateGeneratedAsset(tenantId, id, { status: "approved" });
    if (!asset) {
      json(res, 404, { error: "asset_not_found" });
      return;
    }
    json(res, 200, { asset });
    return;
  }

  // POST /asset/:id/reject
  const rejectMatch = /^\/asset\/([^/]+)\/reject$/.exec(pathname);
  if (req.method === "POST" && rejectMatch) {
    const id = rejectMatch[1]!;
    const asset = await updateGeneratedAsset(tenantId, id, { status: "rejected" });
    if (!asset) {
      json(res, 404, { error: "asset_not_found" });
      return;
    }
    json(res, 200, { asset });
    return;
  }

  json(res, 404, { error: "not_found" });
}
