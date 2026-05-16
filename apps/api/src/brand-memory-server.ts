/**
 * Phase 1 — HTTP server for brand memory ingest + query (`brand_memory_*` tables).
 *
 *   npm run build -w @home-link/marketer-api
 *   npm run start:brand-memory -w @home-link/marketer-api
 *
 * Env:
 *   BRAND_MEMORY_HTTP_HOST (default 127.0.0.1)
 *   BRAND_MEMORY_HTTP_PORT (default 8795)
 *   BRAND_MEMORY_HTTP_PATH_UPSERT (default /api/marketer-pro/brand-memory/sources/upsert) — POST JSON
 *   BRAND_MEMORY_HTTP_PATH_QUERY (default /api/marketer-pro/brand-memory/query) — POST JSON
 *   MARKETER_BRAND_MEMORY_HTTP_TOKEN — optional Bearer token
 *   MARKETER_BRAND_MEMORY_HTTP_CORS — optional CORS (`*` or comma-separated origins)
 *
 * Requires `DATABASE_URL` and migration `006_brand_memory_pgvector.sql`.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { closePostgres } from "./db/postgres.js";
import {
  executeBrandMemoryQueryRequest,
  executeUpsertBrandMemorySourceRequest,
} from "./marketer-pro/brand-memory-route.js";

const MAX_BODY_BYTES = 1024 * 1024;

function corsHeaders(req: IncomingMessage): Record<string, string> | undefined {
  const raw = process.env.MARKETER_BRAND_MEMORY_HTTP_CORS?.trim();
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
  const expected = process.env.MARKETER_BRAND_MEMORY_HTTP_TOKEN?.trim();
  if (!expected) {
    return true;
  }
  const auth = req.headers.authorization?.trim();
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
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

const host = process.env.BRAND_MEMORY_HTTP_HOST ?? "127.0.0.1";
const port = Number(process.env.BRAND_MEMORY_HTTP_PORT ?? 8795);
const pathUpsert =
  process.env.BRAND_MEMORY_HTTP_PATH_UPSERT ??
  "/api/marketer-pro/brand-memory/sources/upsert";
const pathQuery =
  process.env.BRAND_MEMORY_HTTP_PATH_QUERY ??
  "/api/marketer-pro/brand-memory/query";

const knownPaths = new Set([pathUpsert, pathQuery]);

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

  if (req.method === "POST" && pathname === pathUpsert) {
    try {
      const body = await readJsonBody(req);
      const outcome = await executeUpsertBrandMemorySourceRequest(body);
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
          event: "brand_memory_server_unhandled",
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      json(req, res, 500, { error: "internal_error" });
    }
    return;
  }

  if (req.method === "POST" && pathname === pathQuery) {
    try {
      const body = await readJsonBody(req);
      const outcome = await executeBrandMemoryQueryRequest(body);
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
          event: "brand_memory_server_unhandled",
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
      event: "brand_memory_server_listen",
      host,
      port,
      pathUpsert,
      pathQuery,
      auth: process.env.MARKETER_BRAND_MEMORY_HTTP_TOKEN ? "bearer" : "none",
      cors: process.env.MARKETER_BRAND_MEMORY_HTTP_CORS ? "on" : "off",
      database: process.env.DATABASE_URL ? "postgres" : "none",
    }),
  );
});

async function shutdown(signal: string) {
  console.log(
    JSON.stringify({
      level: "info",
      event: "brand_memory_server_shutdown",
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
        event: "brand_memory_server_postgres_close_failed",
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
