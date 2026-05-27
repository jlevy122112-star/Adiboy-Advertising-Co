/**
 * S3 image upload — fetches a temporary URL (e.g. DALL-E 60-min TTL) and
 * puts it into the configured S3 bucket as a permanent, publicly-readable object.
 *
 * Env vars:
 *   AWS_ACCESS_KEY_ID      required
 *   AWS_SECRET_ACCESS_KEY  required
 *   AWS_REGION             default us-east-1
 *   MARKETER_S3_BUCKET     required
 *   MARKETER_S3_PREFIX     optional, default "generated-images/"
 *   MARKETER_S3_PUBLIC_URL optional, custom CDN base (e.g. CloudFront)
 *                          default https://<bucket>.s3.<region>.amazonaws.com
 *
 * Returns the permanent public URL, or null if upload is not configured / fails.
 * Callers must handle null gracefully — publishing continues with the original URL,
 * but platforms that require a long-lived URL (Instagram, TikTok) will warn.
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

const FETCH_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 30_000;

function getS3Client(): S3Client | null {
  const region = process.env.AWS_REGION?.trim() || "us-east-1";
  const key = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secret = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  if (!key || !secret) return null;
  return new S3Client({ region, credentials: { accessKeyId: key, secretAccessKey: secret } });
}

function getS3Config(): { bucket: string; prefix: string; publicBase: string } | null {
  const bucket = process.env.MARKETER_S3_BUCKET?.trim();
  if (!bucket) return null;
  const region = process.env.AWS_REGION?.trim() || "us-east-1";
  const prefix = process.env.MARKETER_S3_PREFIX?.trim() ?? "generated-images/";
  const publicBase = process.env.MARKETER_S3_PUBLIC_URL?.trim()
    ?? `https://${bucket}.s3.${region}.amazonaws.com`;
  return { bucket, prefix, publicBase };
}

function mimeFromUrl(url: string): string {
  const ext = url.split("?")[0]?.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

/**
 * Download a temporary image URL and upload it to S3.
 * Returns the permanent public URL or null if S3 is not configured / fetch fails.
 */
export async function uploadImageToS3(
  temporaryUrl: string,
  platform: string,
): Promise<string | null> {
  const s3 = getS3Client();
  const cfg = getS3Config();
  if (!s3 || !cfg) return null;

  // Download the image
  const fetchController = new AbortController();
  const fetchTimer = setTimeout(() => fetchController.abort(), FETCH_TIMEOUT_MS);
  let imageBuffer: ArrayBuffer;
  let contentType: string;
  try {
    const res = await fetch(temporaryUrl, { signal: fetchController.signal });
    if (!res.ok) return null;
    contentType = res.headers.get("content-type") ?? mimeFromUrl(temporaryUrl);
    imageBuffer = await res.arrayBuffer();
  } catch {
    return null;
  } finally {
    clearTimeout(fetchTimer);
  }

  // Upload to S3
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const key = `${cfg.prefix}${platform}/${randomUUID()}.${ext}`;

  const uploadController = new AbortController();
  const uploadTimer = setTimeout(() => uploadController.abort(), UPLOAD_TIMEOUT_MS);
  try {
    await s3.send(new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: new Uint8Array(imageBuffer),
      ContentType: contentType,
      ACL: "public-read",
      CacheControl: "public, max-age=31536000, immutable",
      Metadata: { platform, source: "dalle3" },
    }), { abortSignal: uploadController.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(uploadTimer);
  }

  return `${cfg.publicBase}/${key}`;
}
