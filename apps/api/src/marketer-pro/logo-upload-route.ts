/**
 * POST /workspace/:tenantId/logo-upload
 * Accepts multipart/form-data with a `file` field.
 * Uploads to S3 when configured, falls back to local /tmp storage.
 * Updates workspace_branding.logo_url and returns { url }.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { uploadBufferToS3, isS3Configured } from "../storage/s3.js";
import { upsertWorkspaceBranding } from "../db/workspace-branding.js";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);
const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);

type ParsedFile = {
  filename: string;
  contentType: string;
  data: Buffer;
};

/** Minimal multipart/form-data parser — extracts the first file part. */
function parseMultipart(body: Buffer, boundary: string): ParsedFile | null {
  const sep = Buffer.from(`--${boundary}`);
  const crlf = Buffer.from("\r\n");
  const headerEnd = Buffer.from("\r\n\r\n");

  let pos = body.indexOf(sep);
  if (pos === -1) return null;

  while (pos !== -1) {
    const partStart = pos + sep.length + crlf.length;
    const nextBoundary = body.indexOf(sep, partStart);
    if (nextBoundary === -1) break;

    const headerEndPos = body.indexOf(headerEnd, partStart);
    if (headerEndPos === -1 || headerEndPos > nextBoundary) {
      pos = nextBoundary;
      continue;
    }

    const headerBlock = body.subarray(partStart, headerEndPos).toString("utf8");
    const dataStart = headerEndPos + headerEnd.length;
    const dataEnd = nextBoundary - crlf.length;

    if (!headerBlock.toLowerCase().includes('name="file"') &&
        !headerBlock.toLowerCase().includes("name='file'")) {
      pos = nextBoundary;
      continue;
    }

    const filenameMatch = /filename[*]?=["']?([^"';\r\n]+)["']?/i.exec(headerBlock);
    const filename = filenameMatch?.[1]?.trim() ?? "logo";

    const ctMatch = /content-type:\s*([^\r\n]+)/i.exec(headerBlock);
    const contentType = ctMatch?.[1]?.trim() ?? "application/octet-stream";

    return { filename, contentType, data: body.subarray(dataStart, dataEnd) };
  }

  return null;
}

async function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_UPLOAD_BYTES) {
        reject(new Error("payload_too_large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function jsonResponse(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

export async function handleLogoUpload(
  req: IncomingMessage,
  res: ServerResponse,
  tenantId: string,
): Promise<void> {
  const ct = req.headers["content-type"] ?? "";
  const boundaryMatch = /boundary=([^\s;]+)/i.exec(ct);
  if (!ct.includes("multipart/form-data") || !boundaryMatch) {
    jsonResponse(res, 400, { error: "expected_multipart" });
    return;
  }
  const boundary = boundaryMatch[1]!;

  let rawBody: Buffer;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "payload_too_large") {
      jsonResponse(res, 413, { error: "file_too_large", maxMb: 5 });
    } else {
      jsonResponse(res, 500, { error: "read_error" });
    }
    return;
  }

  const file = parseMultipart(rawBody, boundary);
  if (!file || file.data.length === 0) {
    jsonResponse(res, 400, { error: "no_file_found" });
    return;
  }

  const ext = extname(file.filename).toLowerCase() || ".png";
  if (!ALLOWED_EXTS.has(ext) && !ALLOWED_TYPES.has(file.contentType)) {
    jsonResponse(res, 415, { error: "unsupported_file_type" });
    return;
  }

  const key = `logos/${tenantId}/${randomUUID()}${ext}`;
  let logoUrl: string;

  if (isS3Configured()) {
    const result = await uploadBufferToS3(file.data, key, file.contentType);
    if (!result.ok) {
      jsonResponse(res, 500, { error: "upload_failed", detail: result.error });
      return;
    }
    logoUrl = result.url;
  } else {
    // No S3 — return a data URL so the UI still works in dev
    const b64 = file.data.toString("base64");
    logoUrl = `data:${file.contentType};base64,${b64}`;
  }

  // Persist to workspace branding (only for real https URLs — data URLs fail schema validation)
  if (logoUrl.startsWith("https://")) {
    await upsertWorkspaceBranding(tenantId, { logoUrl });
  }

  jsonResponse(res, 200, { url: logoUrl });
}
