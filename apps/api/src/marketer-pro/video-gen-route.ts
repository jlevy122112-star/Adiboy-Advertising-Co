/**
 * Phase 7 video generation HTTP routes.
 *
 * POST /generate          — enqueue video render job (async, returns immediately)
 * GET  /script/:id        — get script status
 * GET  /scripts           — list scripts (briefId query param)
 * GET  /job/:id           — get render job status / URL / thumbnailUrl
 * GET  /jobs              — list render jobs (scriptId query param)
 *
 * Tenant header: X-Tenant-Id
 * CORS: MARKETER_VIDEO_GEN_HTTP_CORS
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import type { Queue } from "bullmq";
import { GenerationBriefSchema } from "@home-link/marketer-pro-contract";
import type { VideoRenderJobPayload } from "@home-link/marketer-pro-queue";
import { randomUUID } from "node:crypto";
import { startVideoGeneration } from "./video-generate.js";
import {
  getVideoScript,
  listVideoScripts,
  getVideoRenderJob,
  listVideoRenderJobs,
} from "../db/video-script.js";
import {
  insertGenerationPreset,
  listGenerationPresets,
  getGenerationPreset,
  touchPresetUsed,
  deleteGenerationPreset,
} from "../db/generation-presets.js";
import { listGeneratedAssets } from "../db/generated-asset.js";

function cors(res: ServerResponse): void {
  const origin = process.env.MARKETER_VIDEO_GEN_HTTP_CORS?.trim();
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

const GenerateBodySchema = z.object({
  brief: GenerationBriefSchema,
  network: z.string().optional(),
  voiceover: z.boolean().optional(),
  scheduleEntryId: z.string().optional(),
  customTagline: z.string().max(280).optional(),
  customCta: z.string().max(140).optional(),
});

export function makeVideoGenHandler(queue: Queue<VideoRenderJobPayload>) {
  return async function handleVideoGenRequest(
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

    if (req.method === "POST" && pathname === "/generate") {
      const body = await readBody(req);
      const parsed = GenerateBodySchema.safeParse(body);
      if (!parsed.success) {
        json(res, 400, { error: "invalid_body", issues: parsed.error.issues });
        return;
      }
      const result = await startVideoGeneration({
        tenantId,
        brief: parsed.data.brief,
        network: parsed.data.network,
        voiceover: parsed.data.voiceover,
        scheduleEntryId: parsed.data.scheduleEntryId,
        customTagline: parsed.data.customTagline,
        customCta: parsed.data.customCta,
        queue,
      });
      // 202 Accepted — job is queued, client should poll GET /job/:id
      json(res, result.ok ? 202 : 422, result);
      return;
    }

    if (req.method === "GET" && pathname === "/scripts") {
      const briefId = url.searchParams.get("briefId") ?? undefined;
      const limit = Number(url.searchParams.get("limit") ?? "20");
      const scripts = await listVideoScripts({ tenantId, briefId, limit });
      json(res, 200, { scripts });
      return;
    }

    const scriptMatch = /^\/script\/([^/]+)$/.exec(pathname);
    if (req.method === "GET" && scriptMatch) {
      const id = scriptMatch[1]!;
      const script = await getVideoScript(tenantId, id);
      if (!script) { json(res, 404, { error: "script_not_found" }); return; }
      json(res, 200, { script });
      return;
    }

    if (req.method === "GET" && pathname === "/jobs") {
      const scriptId = url.searchParams.get("scriptId") ?? undefined;
      const limit = Number(url.searchParams.get("limit") ?? "20");
      const jobs = await listVideoRenderJobs({ tenantId, scriptId, limit });
      json(res, 200, { jobs });
      return;
    }

    const jobMatch = /^\/job\/([^/]+)$/.exec(pathname);
    if (req.method === "GET" && jobMatch) {
      const id = jobMatch[1]!;
      const job = await getVideoRenderJob(tenantId, id);
      if (!job) { json(res, 404, { error: "job_not_found" }); return; }
      json(res, 200, { job });
      return;
    }

    // ── History ───────────────────────────────────────────────────────────
    if (req.method === "GET" && pathname === "/history") {
      const limit = Math.min(Number(url.searchParams.get("limit") ?? "30"), 50);
      const genType = url.searchParams.get("type") ?? undefined;
      const [assets, videos] = await Promise.all([
        genType === "video" ? [] : listGeneratedAssets({ tenantId, limit }),
        genType === "image" ? [] : listVideoScripts({ tenantId, limit }),
      ]);
      const history = [
        ...assets
          .filter((a) => a.url)
          .map((a) => ({
            id: a.id, type: "image" as const, platform: a.network ?? "generic",
            title: a.prompt.slice(0, 80), thumbnailUrl: a.url, url: a.url,
            status: a.status, createdAt: a.created_at,
            reuseHint: { network: a.network, prompt: a.prompt },
          })),
        ...videos
          .filter((v) => v.status === "rendered" || v.status === "ready")
          .map((v) => ({
            id: v.id, type: "video" as const, platform: v.platform,
            title: v.title, thumbnailUrl: null as string | null, url: null as string | null,
            status: v.status, createdAt: v.created_at,
            reuseHint: { network: v.platform, headline: v.title, hashtags: v.hashtags_json },
          })),
      ]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit);
      json(res, 200, { history });
      return;
    }

    // ── Presets ───────────────────────────────────────────────────────────
    if (req.method === "GET" && pathname === "/presets") {
      const genType = url.searchParams.get("type") ?? undefined;
      const presets = await listGenerationPresets(tenantId, genType);
      json(res, 200, { presets });
      return;
    }

    if (req.method === "POST" && pathname === "/presets") {
      const PresetBodySchema = z.object({
        name: z.string().min(1).max(120),
        description: z.string().max(500).optional(),
        genType: z.enum(["video", "image", "copy"]).optional(),
        platform: z.string().max(80).optional(),
        headline: z.string().max(500).optional(),
        body: z.string().max(2000).optional(),
        cta: z.string().max(140).optional(),
        mood: z.string().max(120).optional(),
        imageryDirection: z.string().max(500).optional(),
        customTagline: z.string().max(280).optional(),
        toneShift: z.string().max(120).optional(),
        voiceover: z.boolean().optional(),
        quality: z.enum(["standard", "hd"]).optional(),
      });
      const body = await readBody(req);
      const parsed = PresetBodySchema.safeParse(body);
      if (!parsed.success) {
        json(res, 400, { error: "invalid_body", issues: parsed.error.issues });
        return;
      }
      const preset = await insertGenerationPreset({ id: randomUUID(), tenantId, ...parsed.data });
      json(res, preset ? 201 : 500, preset ? { preset } : { error: "db_error" });
      return;
    }

    const presetUseMatch = /^\/presets\/([^/]+)\/use$/.exec(pathname);
    if (req.method === "POST" && presetUseMatch) {
      const id = presetUseMatch[1]!;
      await touchPresetUsed(tenantId, id);
      const preset = await getGenerationPreset(tenantId, id);
      if (!preset) { json(res, 404, { error: "preset_not_found" }); return; }
      json(res, 200, { preset });
      return;
    }

    const presetDeleteMatch = /^\/presets\/([^/]+)$/.exec(pathname);
    if (req.method === "DELETE" && presetDeleteMatch) {
      const id = presetDeleteMatch[1]!;
      const deleted = await deleteGenerationPreset(tenantId, id);
      json(res, deleted ? 200 : 404, deleted ? { ok: true } : { error: "preset_not_found" });
      return;
    }

    json(res, 404, { error: "not_found" });
  };
}

// Backward compat export for video-gen-server.ts
export { makeVideoGenHandler as handleVideoGenRequest };
