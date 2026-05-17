/**
 * Phase 13 autonomous agent HTTP routes.
 *
 * POST /runs                  — start a new autonomous run
 * GET  /runs                  — list runs
 * GET  /runs/:id              — get one run + events
 * POST /runs/:id/cancel       — cancel a run
 * POST /runs/:id/pause        — pause a run
 * POST /runs/:id/resume       — resume a blocked run
 *
 * Tenant header: X-Tenant-Id
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { applyEvent, type PublishableNetwork } from "@home-link/marketer-pro-contract";
import { orchestrateRun } from "../agents/run-orchestrator.js";
import {
  getAutonomousRun,
  listAutonomousRuns,
  updateAutonomousRun,
  appendRunEvent,
  listRunEvents,
} from "../db/autonomous-run.js";

function cors(res: ServerResponse): void {
  const origin = process.env.MARKETER_AUTONOMOUS_HTTP_CORS?.trim();
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

export async function handleAutonomousRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const tenantId = (req.headers["x-tenant-id"] as string | undefined)?.trim();
  if (!tenantId) { json(res, 400, { error: "missing_tenant_id" }); return; }

  const url      = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname.replace(/\/+$/, "");

  // POST /runs
  if (req.method === "POST" && pathname === "/runs") {
    const body = await readBody(req) as {
      networks?: string[];
      scope?: "single_post" | "full_campaign";
    };
    if (!body.networks?.length) { json(res, 400, { error: "networks_required" }); return; }

    const runId = randomUUID();
    json(res, 202, { runId, status: "requested", message: "Run started" });

    orchestrateRun({
      runId,
      workspaceId: tenantId,
      request: {
        workspaceId: tenantId,
        requestedByUserId: "system",
        platforms: body.networks as PublishableNetwork[],
        scope: body.scope ?? "single_post",
      },
      policy: {
        mode: "autonomous",
        autoCommitUserAssistedPoints: false,
        requireApprovalAfterAutonomousCommit: false,
        notifications: {
          firstPublishPerPost: true,
          decisionNeedsAttention: true,
          connectionNeedsReconnect: true,
          errorAlerts: true,
          dailySummary: false,
          channels: ["in_app"],
        },
      },
    }).catch(err => {
      console.error(JSON.stringify({ level: "error", event: "orchestration_error", runId, message: String(err) }));
    });
    return;
  }

  // GET /runs
  if (req.method === "GET" && pathname === "/runs") {
    const state = url.searchParams.get("state") ?? undefined;
    const limit = Number(url.searchParams.get("limit") ?? "20");
    const runs  = await listAutonomousRuns(tenantId, state, limit);
    json(res, 200, { runs });
    return;
  }

  const runMatch    = /^\/runs\/([^/]+)$/.exec(pathname);
  const actionMatch = /^\/runs\/([^/]+)\/(cancel|pause|resume)$/.exec(pathname);

  // POST /runs/:id/cancel|pause|resume
  if (req.method === "POST" && actionMatch) {
    const [, id, action] = actionMatch;
    const run = await getAutonomousRun(id!);
    if (!run) { json(res, 404, { error: "not_found" }); return; }

    const eventId = randomUUID();
    const now = new Date().toISOString();

    type ActionEvent =
      | { eventId: string; runId: string; actorUserId: null; occurredAt: string; type: "cancel_requested" }
      | { eventId: string; runId: string; actorUserId: null; occurredAt: string; type: "pause_requested" }
      | { eventId: string; runId: string; actorUserId: null; occurredAt: string; type: "resume_requested" };

    const event: ActionEvent =
      action === "cancel"
        ? { eventId, runId: run.runId, actorUserId: null, occurredAt: now, type: "cancel_requested" }
        : action === "pause"
        ? { eventId, runId: run.runId, actorUserId: null, occurredAt: now, type: "pause_requested" }
        : { eventId, runId: run.runId, actorUserId: null, occurredAt: now, type: "resume_requested" };

    const result = applyEvent(run, event);

    if (!result.ok) { json(res, 422, { error: "invalid_transition", detail: result.reason }); return; }
    await updateAutonomousRun(result.run);
    await appendRunEvent(run.runId, tenantId, event);
    json(res, 200, { run: result.run });
    return;
  }

  // GET /runs/:id
  if (req.method === "GET" && runMatch) {
    const run = await getAutonomousRun(runMatch[1]!);
    if (!run) { json(res, 404, { error: "not_found" }); return; }
    const events = await listRunEvents(run.runId);
    json(res, 200, { run, events });
    return;
  }

  json(res, 404, { error: "not_found" });
}
