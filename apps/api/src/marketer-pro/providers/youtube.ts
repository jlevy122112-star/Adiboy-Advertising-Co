/**
 * YouTube Data API v3 provider (Phase 5).
 *
 * Publishing flow:
 *   1. Load image URLs from social_credentials metadata (or env var JSON array)
 *   2. Build an MP4 slideshow via FFmpeg (buildSlideshowVideo)
 *   3. Upload the MP4 to S3 and obtain a presigned URL
 *   4. Upload the MP4 to YouTube via resumable upload (2-step HTTP)
 *   5. Return the YouTube video ID as externalId
 *
 * Credential storage (social_credentials row, network = 'youtube'):
 *   access_token — OAuth 2.0 token (youtube.upload scope)
 *   metadata     — {
 *     "channelId":      "<UC...>",          // for logging
 *     "imageUrls":      ["https://..."],     // 1–10 images for slideshow
 *     "secondsPerImage": 3,                  // optional, default 3
 *     "videoFormat":    "widescreen"|"square" // optional, default widescreen
 *   }
 *
 * Env-var fallbacks (single-tenant / dev):
 *   MARKETER_YOUTUBE_ACCESS_TOKEN
 *   MARKETER_YOUTUBE_CHANNEL_ID
 *   MARKETER_YOUTUBE_IMAGE_URLS   — JSON array: '["https://...","https://..."]'
 *
 * Video title:       adaptedCopy.copy.headline → payload.copy.headline → first 100 chars of body → scheduleEntryId
 * Video description: adaptedCopy.copy.body → payload.copy.body → row.content_summary → ""
 *
 * API reference: https://developers.google.com/youtube/v3/docs/videos/insert
 */

import { readFile, unlink } from "node:fs/promises";
import {
  lookupSocialCredential,
  isTokenExpiredOrExpiringSoon,
  refreshSocialCredential,
} from "../../db/social-credentials.js";
import { isRateLimited, rateLimitResult } from "./rate-limit.js";
import { getWorkspaceBranding } from "../../db/workspace-branding.js";
import { isS3Configured } from "../../storage/s3.js";
import { buildSlideshowVideo, type VideoFormat, type VideoSticker } from "../video-builder.js";
import { stubProviderResult } from "./stub.js";
import type { PublishProviderAdapter, PublishProviderInput } from "./types.js";

const YOUTUBE_UPLOAD_URL =
  "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";

type YoutubeCreds = {
  accessToken: string;
  channelId: string | undefined;
  imageUrls: string[];
  secondsPerImage: number;
  videoFormat: VideoFormat;
};

function resolveYoutubeCreds(
  row: import("../../db/social-credentials.js").SocialCredentialRow | undefined,
): YoutubeCreds | undefined {
  const token =
    row?.access_token?.trim() ||
    process.env.MARKETER_YOUTUBE_ACCESS_TOKEN?.trim();
  if (!token) return undefined;

  const channelId =
    (row?.metadata?.["channelId"] as string | undefined)?.trim() ||
    process.env.MARKETER_YOUTUBE_CHANNEL_ID?.trim() ||
    undefined;

  // Image URLs: from metadata array or env var JSON
  let imageUrls: string[] = [];
  const metaUrls = row?.metadata?.["imageUrls"];
  if (Array.isArray(metaUrls)) {
    imageUrls = (metaUrls as unknown[]).filter((u): u is string => typeof u === "string");
  }
  if (imageUrls.length === 0) {
    const envUrls = process.env.MARKETER_YOUTUBE_IMAGE_URLS?.trim();
    if (envUrls) {
      try {
        const parsed: unknown = JSON.parse(envUrls);
        if (Array.isArray(parsed)) {
          imageUrls = (parsed as unknown[]).filter((u): u is string => typeof u === "string");
        }
      } catch {
        // malformed env var — ignore
      }
    }
  }

  const secondsPerImage =
    typeof row?.metadata?.["secondsPerImage"] === "number"
      ? (row.metadata["secondsPerImage"] as number)
      : 3;

  const rawFormat = row?.metadata?.["videoFormat"] as string | undefined;
  const videoFormat: VideoFormat =
    rawFormat === "square" ? "square"
    : rawFormat === "widescreen" ? "widescreen"
    : "shorts";

  return { accessToken: token, channelId, imageUrls, secondsPerImage, videoFormat };
}

function pickTitle(input: PublishProviderInput): string {
  const adapted = input.adaptedCopy?.copy?.headline?.trim();
  if (adapted) return adapted.slice(0, 100);
  const raw = input.payload.copy?.headline?.trim();
  if (raw) return raw.slice(0, 100);
  const body = (input.adaptedCopy?.copy?.body ?? input.payload.copy?.body)?.trim();
  if (body) return body.slice(0, 100);
  return input.payload.scheduleEntryId;
}

function pickDescription(input: PublishProviderInput): string {
  const adapted = input.adaptedCopy?.copy?.body?.trim();
  if (adapted) return adapted.slice(0, 5000);
  const raw = input.payload.copy?.body?.trim();
  if (raw) return raw.slice(0, 5000);
  return input.row?.content_summary?.trim() ?? "";
}

async function resumableUploadToYoutube(
  accessToken: string,
  videoBuffer: Buffer,
  title: string,
  description: string,
): Promise<{ ok: true; videoId: string } | { ok: false; detail: string; retryAfterMs?: number }> {
  // Step 1: Initiate the resumable upload session
  const initRes = await fetch(YOUTUBE_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(videoBuffer.byteLength),
    },
    body: JSON.stringify({
      snippet: {
        title,
        description,
        categoryId: "22", // People & Blogs
      },
      status: {
        privacyStatus: "public",
        selfDeclaredMadeForKids: false,
      },
    }),
  });

  if (isRateLimited(initRes)) return rateLimitResult(initRes, "youtube") as { ok: false; detail: string; retryAfterMs?: number }
  if (!initRes.ok) {
    const body = await initRes.text().catch(() => "");
    return { ok: false, detail: `youtube_upload_init_error:http_${initRes.status}:${body.slice(0, 200)}` };
  }

  const uploadUri = initRes.headers.get("Location");
  if (!uploadUri) {
    return { ok: false, detail: "youtube_upload_init_error:missing_upload_uri" };
  }

  // Step 2: Upload the video bytes
  const uploadRes = await fetch(uploadUri, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(videoBuffer.byteLength),
    },
    // Cast needed: Node.js fetch accepts Buffer at runtime but TS lib types it narrowly
    body: videoBuffer as unknown as BodyInit,
  });

  if (isRateLimited(uploadRes)) return rateLimitResult(uploadRes, "youtube") as { ok: false; detail: string; retryAfterMs?: number }
  if (!uploadRes.ok) {
    const body = await uploadRes.text().catch(() => "");
    return { ok: false, detail: `youtube_upload_error:http_${uploadRes.status}:${body.slice(0, 200)}` };
  }

  const result = (await uploadRes.json().catch(() => ({}))) as { id?: string };
  if (!result.id) {
    return { ok: false, detail: "youtube_upload_error:missing_video_id" };
  }

  return { ok: true, videoId: result.id };
}

export const youtubePublishProvider: PublishProviderAdapter = {
  network: "youtube",

  async publish(input) {
    const { payload, context } = input;

    // --- Credential resolution ---
    const credResult = await lookupSocialCredential(payload.tenantId, "youtube");
    let credRow: import("../../db/social-credentials.js").SocialCredentialRow | undefined;

    if (credResult.mode === "ok") {
      credRow = credResult.row;
      if (isTokenExpiredOrExpiringSoon(credRow)) {
        const refreshed = await refreshSocialCredential(payload.tenantId, "youtube")
        if (refreshed.ok) credRow = { ...credRow, access_token: refreshed.accessToken }
      }
    } else if (credResult.mode === "error") {
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "youtube_provider_credential_error",
          tenantId: payload.tenantId,
          message: credResult.message,
        }),
      );
    }

    const creds = resolveYoutubeCreds(credRow);
    if (!creds) {
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "youtube_provider_no_credential",
          tenantId: payload.tenantId,
          scheduleEntryId: payload.scheduleEntryId,
          hint: "Set MARKETER_YOUTUBE_ACCESS_TOKEN, or upsert social_credentials (network=youtube).",
        }),
      );
      return stubProviderResult("youtube", input);
    }

    // --- Image URLs required for slideshow ---
    if (creds.imageUrls.length === 0) {
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "youtube_provider_no_images",
          tenantId: payload.tenantId,
          scheduleEntryId: payload.scheduleEntryId,
          hint: "Set metadata.imageUrls (array) on the social_credentials row, or MARKETER_YOUTUBE_IMAGE_URLS env var (JSON array).",
        }),
      );
      return { ok: false, detail: "youtube_no_image_urls" };
    }

    if (!isS3Configured()) {
      return { ok: false, detail: "youtube_s3_not_configured" };
    }

    const title = pickTitle(input);
    const description = pickDescription(input);

    try {
      // --- Step 1: Build slideshow MP4 ---
      console.info(
        JSON.stringify({
          level: "info",
          event: "youtube_provider_building_video",
          tenantId: payload.tenantId,
          scheduleEntryId: payload.scheduleEntryId,
          imageCount: creds.imageUrls.length,
        }),
      );

      // Inject brand logo as a bottom-right watermark sticker if configured
      const stickers: VideoSticker[] = [];
      const brandingResult = await getWorkspaceBranding(payload.tenantId);
      if (brandingResult.ok && brandingResult.branding.logoUrl) {
        stickers.push({
          url: brandingResult.branding.logoUrl,
          x: "W-w-20",
          y: "H-h-20",
          width: 150,
          opacity: 0.75,
        });
      }

      const buildResult = await buildSlideshowVideo({
        imageUrls: creds.imageUrls,
        secondsPerImage: creds.secondsPerImage,
        format: creds.videoFormat,
        text: { caption: description.slice(0, 200) },
        stickers,
      });

      if (!buildResult.ok) {
        console.error(
          JSON.stringify({
            level: "error",
            event: "youtube_provider_build_error",
            tenantId: payload.tenantId,
            scheduleEntryId: payload.scheduleEntryId,
            error: buildResult.error,
          }),
        );
        return { ok: false, detail: `youtube_build_error:${buildResult.error.slice(0, 200)}` };
      }

      // --- Step 2: Read MP4 into memory and clean up temp file ---
      const videoBuffer = await readFile(buildResult.outputPath);
      unlink(buildResult.outputPath).catch(() => {});

      // --- Step 3: Upload to YouTube via resumable upload ---
      console.info(
        JSON.stringify({
          level: "info",
          event: "youtube_provider_uploading",
          tenantId: payload.tenantId,
          scheduleEntryId: payload.scheduleEntryId,
          sizeBytes: videoBuffer.byteLength,
        }),
      );

      const uploadResult = await resumableUploadToYoutube(
        creds.accessToken,
        videoBuffer,
        title,
        description,
      );

      if (!uploadResult.ok) {
        console.error(
          JSON.stringify({
            level: "error",
            event: "youtube_provider_upload_error",
            tenantId: payload.tenantId,
            scheduleEntryId: payload.scheduleEntryId,
            attempt: context.attempt,
            detail: uploadResult.detail,
          }),
        );
        return { ok: false, detail: uploadResult.detail };
      }

      console.info(
        JSON.stringify({
          level: "info",
          event: "youtube_provider_published",
          tenantId: payload.tenantId,
          scheduleEntryId: payload.scheduleEntryId,
          videoId: uploadResult.videoId,
          channelId: creds.channelId,
        }),
      );

      return {
        ok: true,
        externalId: `https://youtube.com/watch?v=${uploadResult.videoId}`,
        detail: "youtube_published",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          level: "error",
          event: "youtube_provider_fetch_error",
          tenantId: payload.tenantId,
          scheduleEntryId: payload.scheduleEntryId,
          message,
        }),
      );
      return { ok: false, detail: `youtube_fetch_error:${message.slice(0, 200)}` };
    }
  },
};
