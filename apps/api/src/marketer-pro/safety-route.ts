import { type IncomingMessage, type ServerResponse } from "node:http";
import { ScanRequestSchema } from "@home-link/marketer-pro-contract";
import { runContentScan } from "../safety/content-safety-scanner.js";
import { detectAnomalies } from "../safety/anomaly-detector.js";
import { insertScanResult, listScanResults, getScanResult, updateRemediatedText } from "../db/content-safety-scan.js";
import { insertAnomalyEvent, listAnomalyEvents, acknowledgeAnomaly, countUnacknowledged } from "../db/anomaly-event.js";
import { createDeletionRequest, getDeletionRequest, cancelDeletionRequest } from "../db/account-deletion.js";

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", c => { raw += c; });
    req.on("end", () => { try { resolve(JSON.parse(raw || "null")); } catch { reject(new Error("bad json")); } });
    req.on("error", reject);
  });
}

function workspaceId(req: IncomingMessage): string {
  return (req.headers["x-workspace-id"] as string | undefined) ?? "default";
}

export function buildSafetyRouter() {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const method = req.method ?? "GET";
    const parts = url.pathname.replace(/^\//, "").split("/");

    // POST /scan
    if (method === "POST" && parts[0] === "scan") {
      const body = await readBody(req);
      const parsed = ScanRequestSchema.safeParse(body);
      if (!parsed.success) return json(res, 400, { error: "Invalid body", issues: parsed.error.issues });
      const wid = workspaceId(req);
      const result = await runContentScan({ ...parsed.data, workspaceId: wid });
      const saved = await insertScanResult(result);
      return json(res, 201, saved ?? result);
    }

    // GET /scans
    if (method === "GET" && parts[0] === "scans" && !parts[1]) {
      const wid = workspaceId(req);
      const entityType = url.searchParams.get("entityType") ?? undefined;
      const entityId = url.searchParams.get("entityId") ?? undefined;
      const limit = Number(url.searchParams.get("limit") ?? 20);
      return json(res, 200, await listScanResults(wid, { entityType, entityId, limit }));
    }

    // GET /scans/:id
    if (method === "GET" && parts[0] === "scans" && parts[1]) {
      const scan = await getScanResult(parts[1]!);
      if (!scan) return json(res, 404, { error: "Not found" });
      return json(res, 200, scan);
    }

    // POST /scans/:id/remediate
    if (method === "POST" && parts[0] === "scans" && parts[1] && parts[2] === "remediate") {
      const body = await readBody(req) as { text?: string } | null;
      if (!body || typeof body.text !== "string") return json(res, 400, { error: "text required" });
      const updated = await updateRemediatedText(parts[1]!, body.text);
      if (!updated) return json(res, 404, { error: "Not found" });
      return json(res, 200, updated);
    }

    // POST /anomalies/detect
    if (method === "POST" && parts[0] === "anomalies" && parts[1] === "detect") {
      const wid = workspaceId(req);
      const detected = await detectAnomalies(wid);
      const saved = await Promise.all(detected.map(a => insertAnomalyEvent({
        workspaceId: a.workspaceId, type: a.type, severity: a.severity,
        description: a.description, metadata: a.metadata,
      })));
      return json(res, 200, { detected: saved.filter(Boolean).length });
    }

    // GET /anomalies
    if (method === "GET" && parts[0] === "anomalies" && !parts[1]) {
      const wid = workspaceId(req);
      const limit = Number(url.searchParams.get("limit") ?? 30);
      const [events, unacked] = await Promise.all([
        listAnomalyEvents(wid, limit),
        countUnacknowledged(wid),
      ]);
      return json(res, 200, { events, unacknowledgedCount: unacked });
    }

    // POST /anomalies/:id/acknowledge
    if (method === "POST" && parts[0] === "anomalies" && parts[1] && parts[2] === "acknowledge") {
      const updated = await acknowledgeAnomaly(parts[1]!);
      if (!updated) return json(res, 404, { error: "Not found" });
      return json(res, 200, updated);
    }

    // POST /account-deletion
    if (method === "POST" && parts[0] === "account-deletion") {
      const body = await readBody(req) as { requestedByUserId?: string; reason?: string; scheduleDelayHours?: number } | null;
      if (!body?.requestedByUserId) return json(res, 400, { error: "requestedByUserId required" });
      const wid = workspaceId(req);
      const result = await createDeletionRequest({
        workspaceId: wid, requestedByUserId: body.requestedByUserId,
        reason: body.reason, scheduleDelayHours: body.scheduleDelayHours,
      });
      if (!result) return json(res, 500, { error: "Failed" });
      return json(res, 201, result);
    }

    // GET /account-deletion
    if (method === "GET" && parts[0] === "account-deletion") {
      const wid = workspaceId(req);
      const result = await getDeletionRequest(wid);
      if (!result) return json(res, 404, { error: "No deletion request" });
      return json(res, 200, result);
    }

    // DELETE /account-deletion
    if (method === "DELETE" && parts[0] === "account-deletion") {
      const wid = workspaceId(req);
      await cancelDeletionRequest(wid);
      return json(res, 204, null);
    }

    json(res, 404, { error: "Not found" });
  };
}
