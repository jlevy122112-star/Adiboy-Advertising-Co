/**
 * Phase 1 — HTTP server for tenant-scoped brand intelligence profiles (`brand_profiles`).
 *
 *   npm run build -w @home-link/marketer-api
 *   npm run start:brand-profile -w @home-link/marketer-api
 *
 * Env:
 *   BRAND_PROFILE_HTTP_HOST (default 127.0.0.1)
 *   BRAND_PROFILE_HTTP_PORT (default 8794)
 *   BRAND_PROFILE_HTTP_PATH_UPSERT (default /api/marketer-pro/brand-profiles/upsert) — POST JSON
 *   BRAND_PROFILE_HTTP_PATH_GET (default /api/marketer-pro/brand-profiles/get) — GET ?tenantId=&profileId=
 *   BRAND_PROFILE_HTTP_PATH_LIST (default /api/marketer-pro/brand-profiles/list) — GET ?tenantId=&limit=
 *   MARKETER_BRAND_PROFILE_HTTP_TOKEN — optional Bearer token
 *   MARKETER_BRAND_PROFILE_HTTP_CORS — optional CORS for browser clients (`*` or comma-separated origins)
 *
 * Requires `DATABASE_URL` and migration `005_brand_profiles.sql`.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { closePostgres } from "./db/postgres.js";
import { requireAuth } from "./marketer-pro/auth/middleware.js";
import {
  executeGetBrandProfileRequestFromSearchParams,
  executeListBrandProfilesRequestFromSearchParams,
  executeUpsertBrandProfileRequest,
} from "./marketer-pro/brand-profile-route.js";
import {
  executeGetBrandingRequestFromSearchParams,
  executePutBrandingRequest,
} from "./marketer-pro/branding-route.js";
import { handleLogoUpload } from "./marketer-pro/logo-upload-route.js";

const MAX_BODY_BYTES = 1024 * 1024;

function corsHeaders(req: IncomingMessage): Record<string, string> | undefined {
  const raw = process.env.MARKETER_BRAND_PROFILE_HTTP_CORS?.trim();
  if (!raw) {
    return undefined;
  }
  const base: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
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
  const expected = process.env.MARKETER_BRAND_PROFILE_HTTP_TOKEN?.trim();
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

const host = process.env.BRAND_PROFILE_HTTP_HOST ?? "127.0.0.1";
const port = Number(process.env.BRAND_PROFILE_HTTP_PORT ?? 8794);
const pathUpsert =
  process.env.BRAND_PROFILE_HTTP_PATH_UPSERT ??
  "/api/marketer-pro/brand-profiles/upsert";
const pathGet =
  process.env.BRAND_PROFILE_HTTP_PATH_GET ??
  "/api/marketer-pro/brand-profiles/get";
const pathList =
  process.env.BRAND_PROFILE_HTTP_PATH_LIST ??
  "/api/marketer-pro/brand-profiles/list";
const pathBrandingPut = "/api/marketer-pro/branding";
const pathBrandingGet = "/api/marketer-pro/branding";

const knownPaths = new Set([pathUpsert, pathGet, pathList, pathBrandingPut]);
const logoUploadRe = /^\/workspace\/([^/]+)\/logo-upload$/;

const server = createServer(async (req, res) => {
  let fullUrl: URL;
  try {
    fullUrl = new URL(req.url ?? "/", `http://${host}`);
  } catch {
    json(req, res, 400, { error: "bad_request" });
    return;
  }
  const {pathname} = fullUrl;

  // Logo upload — dynamic path, handle before knownPaths check
  const logoMatch = logoUploadRe.exec(pathname);
  if (logoMatch) {
    if (req.method === "OPTIONS") {
      const c = corsHeaders(req);
      if (c) { res.writeHead(204, c); res.end(); } else { res.writeHead(204); res.end(); }
      return;
    }
    if (req.method !== "POST") {
      json(req, res, 405, { error: "method_not_allowed" });
      return;
    }
    const tenantId = logoMatch[1]!;
    await handleLogoUpload(req, res, tenantId);
    return;
  }

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

  const auth = await requireAuth(req, res);
  if (!auth) return;
  req.headers["x-tenant-id"] = auth.tenantId;

  if (req.method === "GET" && pathname === pathGet) {
    const outcome = await executeGetBrandProfileRequestFromSearchParams(
      fullUrl.searchParams,
    );
    json(req, res, outcome.status, outcome.body);
    return;
  }

  if (req.method === "GET" && pathname === pathList) {
    const outcome = await executeListBrandProfilesRequestFromSearchParams(
      fullUrl.searchParams,
    );
    json(req, res, outcome.status, outcome.body);
    return;
  }

  if (req.method === "GET" && pathname === pathBrandingGet) {
    const outcome = await executeGetBrandingRequestFromSearchParams(fullUrl.searchParams);
    json(req, res, outcome.status, outcome.body);
    return;
  }

  if (req.method === "PUT" && pathname === pathBrandingPut) {
    try {
      const body = await readJsonBody(req);
      const outcome = await executePutBrandingRequest(body);
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
          event: "branding_server_unhandled",
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      json(req, res, 500, { error: "internal_error" });
    }
    return;
  }

  if (req.method === "POST" && pathname === pathUpsert) {
    try {
      const body = await readJsonBody(req);
      const outcome = await executeUpsertBrandProfileRequest(body);
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
          event: "brand_profile_server_unhandled",
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
      event: "brand_profile_server_listen",
      host,
      port,
      pathUpsert,
      pathGet,
      pathList,
      auth: process.env.MARKETER_BRAND_PROFILE_HTTP_TOKEN ? "bearer" : "none",
      cors: process.env.MARKETER_BRAND_PROFILE_HTTP_CORS ? "on" : "off",
      database: process.env.DATABASE_URL ? "postgres" : "none",
    }),
  );
});

async function shutdown(signal: string) {
  console.log(
    JSON.stringify({
      level: "info",
      event: "brand_profile_server_shutdown",
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
        event: "brand_profile_server_postgres_close_failed",
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
