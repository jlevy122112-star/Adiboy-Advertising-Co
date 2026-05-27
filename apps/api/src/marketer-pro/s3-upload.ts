/**
 * S3 image upload — fetches a temporary URL (e.g. DALL-E 60-min TTL),
 * resizes + converts to WebP at exact platform pixel spec, then uploads
 * to S3 as a permanent, publicly-readable object.
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

import sharp from "sharp";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

const FETCH_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 30_000;

// ── SSRF allowlist ─────────────────────────────────────────────────────────────
// Only fetch images from domains we trust. Prevents server-side request forgery
// if a malicious URL somehow reaches this function.
const ALLOWED_IMAGE_HOSTNAMES = new Set([
  "oaidalleapiprodscus.blob.core.windows.net", // DALL-E 3 temporary URLs
  "oaidalle3apiprodscus.blob.core.windows.net",
  "oaidalleprodscus.blob.core.windows.net",
  "cdn.openai.com",
]);

// Also allow the configured S3 bucket hostname at runtime
function getAllowedHostnames(): Set<string> {
  const s = new Set(ALLOWED_IMAGE_HOSTNAMES);
  const bucket = process.env.MARKETER_S3_BUCKET?.trim();
  const region = process.env.AWS_REGION?.trim() || "us-east-1";
  if (bucket) s.add(`${bucket}.s3.${region}.amazonaws.com`);
  const custom = process.env.MARKETER_S3_PUBLIC_URL?.trim();
  if (custom) {
    try { s.add(new URL(custom).hostname); } catch { /* ignore */ }
  }
  return s;
}

function isSafeImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;           // https only
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return false;
    if (u.hostname.startsWith("169.254.") || u.hostname.startsWith("10.") || u.hostname.startsWith("192.168.")) return false;
    return getAllowedHostnames().has(u.hostname);
  } catch {
    return false;
  }
}

// ── Exact platform pixel specs ─────────────────────────────────────────────
// Source: each platform's official developer/content guidelines.
// DALL-E 3 generates at the nearest supported size (1024×1024 | 1792×1024 | 1024×1792);
// sharp resizes to the exact spec before S3 upload so every stored asset
// is publish-ready at the correct dimensions.

const PLATFORM_DIMENSIONS: Record<string, { width: number; height: number }> = {
  ig:  { width: 1080, height: 1080 }, // Instagram feed — 1:1 square
  li:  { width: 1200, height: 627  }, // LinkedIn shared image — 1.91:1
  x:   { width: 1200, height: 675  }, // X (Twitter) card — 16:9
  fb:  { width: 1200, height: 630  }, // Facebook OG / feed — 1.91:1
  tt:  { width: 1080, height: 1920 }, // TikTok cover — 9:16 vertical
  // Story / Reel formats (same as TikTok vertical)
  ig_story:  { width: 1080, height: 1920 },
  ig_reel:   { width: 1080, height: 1920 },
  fb_story:  { width: 1080, height: 1920 },
  // YouTube thumbnail
  yt:  { width: 1280, height: 720  }, // YouTube thumbnail — 16:9
  // Pinterest
  pin: { width: 1000, height: 1500 }, // Pinterest standard — 2:3
  // LinkedIn Story
  li_story: { width: 1080, height: 1920 },
};

// WebP at 85% quality — matches DEFAULT_IMAGE_OPTIMIZATION in the contract package.
// Cover fit: crops to fill exact dimensions from centre — no letterboxing, no distortion.
const OUTPUT_QUALITY = 85;

async function resizeForPlatform(
  buffer: Buffer,
  platform: string,
): Promise<{ data: Buffer; contentType: string }> {
  const dims = PLATFORM_DIMENSIONS[platform];
  let pipeline = sharp(buffer)
    .rotate();                // auto-orient from EXIF (EXIF stripped by .webp() output below)

  if (dims) {
    pipeline = pipeline.resize(dims.width, dims.height, {
      fit: "cover",           // crop to fill — no black bars
      position: "centre",     // centre-crop keeps the main subject
      withoutEnlargement: false, // allow upscale (e.g. 1024→1080 for IG)
    });
  }

  const data = await pipeline
    .webp({ quality: OUTPUT_QUALITY, effort: 4 })
    .toBuffer();

  return { data, contentType: "image/webp" };
}

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

/**
 * Download a temporary image URL, resize + convert to WebP at exact platform
 * pixel spec, then upload to S3 as a permanent public asset.
 * Returns the permanent public URL or null if S3 is not configured / fails.
 */
export async function uploadImageToS3(
  temporaryUrl: string,
  platform: string,
): Promise<string | null> {
  const s3 = getS3Client();
  const cfg = getS3Config();
  if (!s3 || !cfg) return null;

  // SSRF guard — only fetch from known-safe domains
  if (!isSafeImageUrl(temporaryUrl)) {
    console.warn(JSON.stringify({ level: "warn", event: "s3_upload_blocked_ssrf", platform }));
    return null;
  }

  // Download the image
  const fetchController = new AbortController();
  const fetchTimer = setTimeout(() => fetchController.abort(), FETCH_TIMEOUT_MS);
  let rawBuffer: Buffer;
  try {
    const res = await fetch(temporaryUrl, { signal: fetchController.signal });
    if (!res.ok) return null;
    rawBuffer = Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  } finally {
    clearTimeout(fetchTimer);
  }

  // Resize to exact platform spec + convert to WebP
  let processedBuffer: Buffer;
  let contentType: string;
  try {
    const result = await resizeForPlatform(rawBuffer, platform);
    processedBuffer = result.data;
    contentType = result.contentType;
  } catch {
    // If sharp fails (corrupt image, etc.) fall back to raw upload
    processedBuffer = rawBuffer;
    contentType = "image/jpeg";
  }

  // Verify dimensions for logging
  let finalDims = "";
  try {
    const meta = await sharp(processedBuffer).metadata();
    finalDims = `${meta.width}x${meta.height}`;
  } catch { /* non-critical */ }

  // Upload to S3
  const key = `${cfg.prefix}${platform}/${randomUUID()}.webp`;
  const dims = PLATFORM_DIMENSIONS[platform];
  const dimsLabel = dims ? `${dims.width}x${dims.height}` : "original";

  const uploadController = new AbortController();
  const uploadTimer = setTimeout(() => uploadController.abort(), UPLOAD_TIMEOUT_MS);
  try {
    await s3.send(new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: processedBuffer,
      ContentType: contentType,
      ACL: "public-read",
      CacheControl: "public, max-age=31536000, immutable",
      Metadata: {
        platform,
        source: "dalle3",
        targetDimensions: dimsLabel,
        actualDimensions: finalDims,
        format: "webp",
        quality: String(OUTPUT_QUALITY),
      },
    }), { abortSignal: uploadController.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(uploadTimer);
  }

  return `${cfg.publicBase}/${key}`;
}

