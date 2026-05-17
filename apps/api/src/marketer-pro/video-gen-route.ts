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
import { startVideoGeneration } from "./video-generate.js";
import {
  getVideoScript,
  listVideoScripts,
  getVideoRenderJob,
  listVideoRenderJobs,
} from "../db/video-script.js";

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

    json(res, 404, { error: "not_found" });
  };
}

// Backward compat export for video-gen-server.ts
export { makeVideoGenHandler as handleVideoGenRequest };
