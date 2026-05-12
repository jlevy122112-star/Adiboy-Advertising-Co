/**
 * Phase 2 — HTTP server for brief → draft + human approval persistence.
 *
 *   npm run build -w @home-link/marketer-api
 *   node apps/api/dist/generation-draft-server.js
 *
 * Env:
 *   GENERATION_DRAFT_HOST  (default 127.0.0.1)
 *   GENERATION_DRAFT_PORT  (default 8792)
 *   GENERATION_DRAFT_PATH_CREATE  (default /api/marketer-pro/generation/draft-from-brief)
 *   GENERATION_DRAFT_PATH_APPROVE (default /api/marketer-pro/generation/draft-approve)
 *   GENERATION_DRAFT_PATH_REJECT  (default /api/marketer-pro/generation/draft-reject)
 *   GENERATION_DRAFT_PATH_GET (default /api/marketer-pro/generation/draft) — GET ?tenantId=&draftId=
 *   GENERATION_DRAFT_PATH_LIST_BY_BRIEF (default /api/marketer-pro/generation/drafts-by-brief) — GET ?tenantId=&briefId=&limit=
 *   MARKETER_GENERATION_HTTP_TOKEN — if set, require matching Bearer token
 *   MARKETER_GENERATION_HTTP_CORS — optional CORS for browser clients: `*` (dev) or
 *     comma-separated allowed `Origin` values (same pattern as campaign server)
 *
 * Requires `DATABASE_URL` for all routes (Postgres `generation_drafts` table).
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { closePostgres } from "./db/postgres.js";
import {
  executeApproveGenerationDraftRequest,
  executeCreateGenerationDraftRequest,
  executeGetGenerationDraftRequestFromSearchParams,
  executeListGenerationDraftsRequestFromSearchParams,
  executeRejectGenerationDraftRequest,
} from "./marketer-pro/generation-draft-route.js";

const MAX_BODY_BYTES = 512 * 1024;

function corsHeaders(req: IncomingMessage): Record<string, string> | undefined {
  const raw = process.env.MARKETER_GENERATION_HTTP_CORS?.trim();
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
  const expected = process.env.MARKETER_GENERATION_HTTP_TOKEN?.trim();
  if (!expected) {
    return true;
  }
  const auth = req.headers.authorization?.trim();
  if (!auth?.toLowerCase().startsWith("bearer ")) {
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

const host = process.env.GENERATION_DRAFT_HOST ?? "127.0.0.1";
const port = Number(process.env.GENERATION_DRAFT_PORT ?? 8792);
const pathCreate =
  process.env.GENERATION_DRAFT_PATH_CREATE ??
  "/api/marketer-pro/generation/draft-from-brief";
const pathApprove =
  process.env.GENERATION_DRAFT_PATH_APPROVE ??
  "/api/marketer-pro/generation/draft-approve";
const pathReject =
  process.env.GENERATION_DRAFT_PATH_REJECT ??
  "/api/marketer-pro/generation/draft-reject";
const pathGet =
  process.env.GENERATION_DRAFT_PATH_GET ??
  "/api/marketer-pro/generation/draft";
const pathListByBrief =
  process.env.GENERATION_DRAFT_PATH_LIST_BY_BRIEF ??
  "/api/marketer-pro/generation/drafts-by-brief";

const knownPaths = new Set([
  pathCreate,
  pathApprove,
  pathReject,
  pathGet,
  pathListByBrief,
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
    const outcome = await executeGetGenerationDraftRequestFromSearchParams(
      fullUrl.searchParams,
    );
    json(req, res, outcome.status, outcome.body);
    return;
  }
  if (req.method === "GET" && pathname === pathListByBrief) {
    const outcome = await executeListGenerationDraftsRequestFromSearchParams(
      fullUrl.searchParams,
    );
    json(req, res, outcome.status, outcome.body);
    return;
  }

  if (
    req.method !== "POST" ||
    (pathname !== pathCreate &&
      pathname !== pathApprove &&
      pathname !== pathReject)
  ) {
    json(req, res, 405, { error: "method_not_allowed" });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const outcome =
      pathname === pathCreate
        ? await executeCreateGenerationDraftRequest(body)
        : pathname === pathApprove
          ? await executeApproveGenerationDraftRequest(body)
          : await executeRejectGenerationDraftRequest(body);

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
        event: "generation_draft_unhandled",
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    json(req, res, 500, { error: "internal_error" });
  }
});

server.listen(port, host, () => {
  console.log(
    JSON.stringify({
      level: "info",
      event: "generation_draft_server_listen",
      host,
      port,
      pathCreate,
      pathApprove,
      pathReject,
      pathGet,
      pathListByBrief,
      auth: process.env.MARKETER_GENERATION_HTTP_TOKEN ? "bearer" : "none",
      cors: process.env.MARKETER_GENERATION_HTTP_CORS ? "on" : "off",
      database: process.env.DATABASE_URL ? "postgres" : "none",
    }),
  );
});

async function shutdown(signal: string) {
  console.log(
    JSON.stringify({
      level: "info",
      event: "generation_draft_server_shutdown",
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
        event: "generation_draft_postgres_close_failed",
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
