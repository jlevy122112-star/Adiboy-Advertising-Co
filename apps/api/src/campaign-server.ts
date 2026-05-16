/**
 * Phase 4 — HTTP server for tenant-scoped campaigns (`campaigns` table).
 *
 *   npm run build -w @home-link/marketer-api
 *   npm run start:campaign -w @home-link/marketer-api
 *
 * Env:
 *   CAMPAIGN_HTTP_HOST (default 127.0.0.1)
 *   CAMPAIGN_HTTP_PORT (default 8793)
 *   CAMPAIGN_HTTP_PATH_CREATE (default /api/marketer-pro/campaigns/create) — POST JSON
 *   CAMPAIGN_HTTP_PATH_GET (default /api/marketer-pro/campaigns/get) — GET ?tenantId=&campaignId=
 *   CAMPAIGN_HTTP_PATH_LIST (default /api/marketer-pro/campaigns/list) — GET ?tenantId=&limit=
 *   CAMPAIGN_HTTP_PATH_SCHEDULE_ATTACH (default /api/marketer-pro/campaigns/schedule-attach) — POST JSON (`AttachScheduleEntryCampaignBodySchema` from `@home-link/marketer-pro-contract`)
 *   CAMPAIGN_HTTP_PATH_SCHEDULE_LIST (default /api/marketer-pro/campaigns/schedule-entries) — GET ?tenantId=&campaignId=&limit= (optional limit 1–100, default 50; `ListScheduleEntriesForCampaignQuerySchema`)
 *   MARKETER_CAMPAIGN_HTTP_TOKEN — optional Bearer token
 *   MARKETER_CAMPAIGN_HTTP_CORS — optional CORS for browser clients: `*` (dev) or
 *     comma-separated allowed `Origin` values (e.g. `http://localhost:5173`)
 *
 * Requires `DATABASE_URL` and migration `003_campaigns_and_schedule_campaign_id.sql`.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { closePostgres } from "./db/postgres.js";
import {
  executeAttachScheduleEntryCampaignRequest,
  executeCreateCampaignRequest,
  executeCreateScheduleEntryRequest,
  executeDeleteScheduleEntryRequest,
  executeGetCampaignRequestFromSearchParams,
  executeListCampaignsRequestFromSearchParams,
  executeListScheduleEntriesByTenantRequestFromSearchParams,
  executeListScheduleEntriesForCampaignRequestFromSearchParams,
  executeUpdateScheduleEntryRequest,
} from "./marketer-pro/campaign-route.js";

const MAX_BODY_BYTES = 256 * 1024;

function corsHeaders(req: IncomingMessage): Record<string, string> | undefined {
  const raw = process.env.MARKETER_CAMPAIGN_HTTP_CORS?.trim();
  if (!raw) {
    return undefined;
  }
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  if (raw === "*") {
    return { ...base, "Access-Control-Allow-Origin": "*" };
  }
  const allowed = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.origin;
  if (!origin || !allowed.includes(origin)) {
    return undefined;
  }
  return { ...base, "Access-Control-Allow-Origin": origin, Vary: "Origin" };
}

function json(
  req: IncomingMessage,
  res: ServerResponse,
  status: number,
  body: unknown,
) {
  const payload = JSON.stringify(body);
  const headers: Record<string, string | number> = {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  };
  const c = corsHeaders(req);
  if (c) {
    Object.assign(headers, c);
  }
  res.writeHead(status, headers);
  res.end(payload);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_BODY_BYTES) {
      throw new Error("request_entity_too_large");
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) {
    return undefined;
  }
  return JSON.parse(raw) as unknown;
}

function unauthorized(req: IncomingMessage, res: ServerResponse) {
  json(req, res, 401, { error: "unauthorized" });
}

function checkBearer(req: IncomingMessage, res: ServerResponse): boolean {
  const expected = process.env.MARKETER_CAMPAIGN_HTTP_TOKEN?.trim();
  if (!expected) {
    return true;
  }
  const auth = req.headers.authorization?.trim();
  if (!auth?.toLowerCase()?.startsWith("bearer ")) {
    unauthorized(req, res);
    return false;
  }
  const token = auth.slice(7).trim();
  if (token !== expected) {
    unauthorized(req, res);
    return false;
  }
  return true;
}

const host = process.env.CAMPAIGN_HTTP_HOST ?? "127.0.0.1";
const port = Number(process.env.CAMPAIGN_HTTP_PORT ?? 8793);
const pathCreate =
  process.env.CAMPAIGN_HTTP_PATH_CREATE ??
  "/api/marketer-pro/campaigns/create";
const pathGet =
  process.env.CAMPAIGN_HTTP_PATH_GET ?? "/api/marketer-pro/campaigns/get";
const pathList =
  process.env.CAMPAIGN_HTTP_PATH_LIST ?? "/api/marketer-pro/campaigns/list";
const pathScheduleAttach =
  process.env.CAMPAIGN_HTTP_PATH_SCHEDULE_ATTACH ??
  "/api/marketer-pro/campaigns/schedule-attach";
const pathScheduleList =
  process.env.CAMPAIGN_HTTP_PATH_SCHEDULE_LIST ??
  "/api/marketer-pro/campaigns/schedule-entries";
const pathScheduleCreate =
  process.env.CAMPAIGN_HTTP_PATH_SCHEDULE_CREATE ??
  "/api/marketer-pro/campaigns/schedule-entries/create";
const pathScheduleListByTenant =
  process.env.CAMPAIGN_HTTP_PATH_SCHEDULE_LIST_TENANT ??
  "/api/marketer-pro/schedule-entries";
const pathScheduleDelete =
  process.env.CAMPAIGN_HTTP_PATH_SCHEDULE_DELETE ??
  "/api/marketer-pro/schedule-entries/delete";
const pathScheduleUpdate =
  process.env.CAMPAIGN_HTTP_PATH_SCHEDULE_UPDATE ??
  "/api/marketer-pro/schedule-entries/update";

const knownPaths = new Set([
  pathCreate,
  pathGet,
  pathList,
  pathScheduleAttach,
  pathScheduleList,
  pathScheduleCreate,
  pathScheduleListByTenant,
  pathScheduleDelete,
  pathScheduleUpdate,
]);

const server = createServer(async (req, res) => {
  let fullUrl: URL;
  try {
    fullUrl = new URL(req.url ?? "/", `http://${host}`);
  } catch {
    json(req, res, 400, { error: "bad_request" });
    return;
  }
  const pathname = fullUrl.pathname;

  if (!knownPaths.has(pathname)) {
    json(req, res, 404, { error: "not_found" });
    return;
  }

  if (req.method === "OPTIONS") {
    const c = corsHeaders(req);
    if (c) {
      res.writeHead(204, c);
      res.end();
      return;
    }
  }

  if (!checkBearer(req, res)) {
    return;
  }

  if (req.method === "GET" && pathname === pathGet) {
    const outcome = await executeGetCampaignRequestFromSearchParams(
      fullUrl.searchParams,
    );
    json(req, res, outcome.status, outcome.body);
    return;
  }
  if (req.method === "GET" && pathname === pathList) {
    const outcome = await executeListCampaignsRequestFromSearchParams(
      fullUrl.searchParams,
    );
    json(req, res, outcome.status, outcome.body);
    return;
  }
  if (req.method === "GET" && pathname === pathScheduleList) {
    const outcome =
      await executeListScheduleEntriesForCampaignRequestFromSearchParams(
        fullUrl.searchParams,
      );
    json(req, res, outcome.status, outcome.body);
    return;
  }

  if (req.method === "POST" && pathname === pathCreate) {
    try {
      const body = await readJsonBody(req);
      const outcome = await executeCreateCampaignRequest(body);
      json(req, res, outcome.status, outcome.body);
    } catch (err) {
      if (err instanceof SyntaxError) {
        json(req, res, 400, { error: "invalid_json" });
        return;
      }
      if (err instanceof Error && err.message === "request_entity_too_large") {
        json(req, res, 413, { error: "payload_too_large" });
        return;
      }
      console.error(
        JSON.stringify({
          level: "error",
          event: "campaign_server_unhandled",
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      json(req, res, 500, { error: "internal_error" });
    }
    return;
  }

  if (req.method === "POST" && pathname === pathScheduleCreate) {
    try {
      const body = await readJsonBody(req);
      const outcome = await executeCreateScheduleEntryRequest(body);
      json(req, res, outcome.status, outcome.body);
    } catch (err) {
      if (err instanceof SyntaxError) {
        json(req, res, 400, { error: "invalid_json" });
        return;
      }
      if (err instanceof Error && err.message === "request_entity_too_large") {
        json(req, res, 413, { error: "payload_too_large" });
        return;
      }
      console.error(
        JSON.stringify({
          level: "error",
          event: "campaign_server_unhandled",
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      json(req, res, 500, { error: "internal_error" });
    }
    return;
  }

  if (req.method === "POST" && pathname === pathScheduleAttach) {
    try {
      const body = await readJsonBody(req);
      const outcome = await executeAttachScheduleEntryCampaignRequest(body);
      json(req, res, outcome.status, outcome.body);
    } catch (err) {
      if (err instanceof SyntaxError) {
        json(req, res, 400, { error: "invalid_json" });
        return;
      }
      if (err instanceof Error && err.message === "request_entity_too_large") {
        json(req, res, 413, { error: "payload_too_large" });
        return;
      }
      console.error(
        JSON.stringify({
          level: "error",
          event: "campaign_server_unhandled",
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      json(req, res, 500, { error: "internal_error" });
    }
    return;
  }

  if (req.method === "GET" && pathname === pathScheduleListByTenant) {
    const outcome =
      await executeListScheduleEntriesByTenantRequestFromSearchParams(
        fullUrl.searchParams,
      );
    json(req, res, outcome.status, outcome.body);
    return;
  }

  if (req.method === "POST" && pathname === pathScheduleDelete) {
    try {
      const body = await readJsonBody(req);
      const outcome = await executeDeleteScheduleEntryRequest(body);
      json(req, res, outcome.status, outcome.body);
    } catch (err) {
      if (err instanceof SyntaxError) {
        json(req, res, 400, { error: "invalid_json" });
        return;
      }
      if (err instanceof Error && err.message === "request_entity_too_large") {
        json(req, res, 413, { error: "payload_too_large" });
        return;
      }
      console.error(
        JSON.stringify({
          level: "error",
          event: "campaign_server_unhandled",
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      json(req, res, 500, { error: "internal_error" });
    }
    return;
  }

  if (req.method === "POST" && pathname === pathScheduleUpdate) {
    try {
      const body = await readJsonBody(req);
      const outcome = await executeUpdateScheduleEntryRequest(body);
      json(req, res, outcome.status, outcome.body);
    } catch (err) {
      if (err instanceof SyntaxError) {
        json(req, res, 400, { error: "invalid_json" });
        return;
      }
      if (err instanceof Error && err.message === "request_entity_too_large") {
        json(req, res, 413, { error: "payload_too_large" });
        return;
      }
      console.error(
        JSON.stringify({
          level: "error",
          event: "campaign_server_unhandled",
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      json(req, res, 500, { error: "internal_error" });
    }
    return;
  }

  json(req, res, 405, { error: "method_not_allowed" });
});

server.listen(port, host, () => {
  console.log(
    JSON.stringify({
      level: "info",
      event: "campaign_server_listen",
      host,
      port,
      pathCreate,
      pathGet,
      pathList,
      pathScheduleCreate,
      pathScheduleAttach,
      pathScheduleList,
      auth: process.env.MARKETER_CAMPAIGN_HTTP_TOKEN ? "bearer" : "none",
      cors: process.env.MARKETER_CAMPAIGN_HTTP_CORS ? "on" : "off",
      database: process.env.DATABASE_URL ? "postgres" : "none",
    }),
  );
});

async function shutdown(signal: string) {
  console.log(
    JSON.stringify({
      level: "info",
      event: "campaign_server_shutdown",
      signal,
    }),
  );
  await new Promise<void>((resolve) => server.close(() => resolve()));
  try {
    await closePostgres();
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "campaign_server_postgres_close_failed",
        message: err instanceof Error ? err.message : String(err),
      }),
    );
  }
  process.exit(0);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    shutdown(sig).catch((err) => {
      console.error(err);
      process.exit(1);
    });
  });
}
