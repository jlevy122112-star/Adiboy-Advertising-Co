/**
 * Minimal internal HTTP server for worker → API publish execution.
 *
 *   npm run build -w @home-link/marketer-api
 *   node apps/api/dist/internal-publish-server.js
 *
 * Env:
 *   INTERNAL_PUBLISH_HOST (default 127.0.0.1)
 *   INTERNAL_PUBLISH_PORT (default 8790)
 *   INTERNAL_PUBLISH_PATH (default /internal/publish/execute)
 *   MARKETER_PUBLISH_HTTP_TOKEN — if set, require matching Bearer token
 *
 * Success **200** body: flat {@link PublishJobResult}. Validation **400** body:
 * `{ error: "validation_error", message, issues[] }` (see `executeInternalPublishHttp`).
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { closePostgres } from "./db/postgres.js";
import { executeInternalPublishHttp } from "./marketer-pro/publish-execute.js";

const MAX_BODY_BYTES = 256 * 1024;

function json(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
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

function unauthorized(res: ServerResponse) {
  json(res, 401, { error: "unauthorized" });
}

function checkBearer(req: IncomingMessage, res: ServerResponse): boolean {
  const expected = process.env.MARKETER_PUBLISH_HTTP_TOKEN?.trim();
  if (!expected) {
    return true;
  }
  const auth = req.headers.authorization?.trim();
  if (!auth?.toLowerCase()?.startsWith("bearer ")) {
    unauthorized(res);
    return false;
  }
  const token = auth.slice(7).trim();
  if (token !== expected) {
    unauthorized(res);
    return false;
  }
  return true;
}

const host = process.env.INTERNAL_PUBLISH_HOST ?? "127.0.0.1";
const port = Number(process.env.INTERNAL_PUBLISH_PORT ?? 8790);
const path =
  process.env.INTERNAL_PUBLISH_PATH ?? "/internal/publish/execute";

const server = createServer(async (req, res) => {
  if (req.method !== "POST") {
    json(res, 405, { error: "method_not_allowed" });
    return;
  }

  let pathname = req.url ?? "/";
  try {
    pathname = new URL(req.url ?? "/", `http://${host}`).pathname;
  } catch {
    json(res, 400, { error: "bad_request" });
    return;
  }

  if (pathname !== path) {
    json(res, 404, { error: "not_found" });
    return;
  }

  if (!checkBearer(req, res)) {
    return;
  }

  try {
    const body = await readJsonBody(req);
    const http = await executeInternalPublishHttp(body);

    if (http.status !== 200) {
      json(res, http.status, http.body);
      return;
    }

    json(res, 200, http.body);
  } catch (err) {
    if (err instanceof SyntaxError) {
      json(res, 400, { error: "invalid_json" });
      return;
    }
    if (err instanceof Error && err.message === "request_entity_too_large") {
      json(res, 413, { error: "payload_too_large" });
      return;
    }
    console.error(
      JSON.stringify({
        level: "error",
        event: "internal_publish_unhandled",
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    json(res, 500, { error: "internal_error" });
  }
});

server.listen(port, host, () => {
  console.log(
    JSON.stringify({
      level: "info",
      event: "internal_publish_server_listen",
      host,
      port,
      path,
      auth: process.env.MARKETER_PUBLISH_HTTP_TOKEN ? "bearer" : "none",
      database: process.env.DATABASE_URL ? "postgres" : "none",
    }),
  );
});

async function shutdown(signal: string) {
  console.log(
    JSON.stringify({
      level: "info",
      event: "internal_publish_server_shutdown",
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
        event: "internal_publish_postgres_close_failed",
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
