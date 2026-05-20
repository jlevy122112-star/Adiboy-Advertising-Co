/**
 * TikTok Content Posting API provider — Creative + Content Management Partner.
 *
 * Supports two content modes based on payload:
 *
 *   PHOTO (default when no video URL supplied):
 *     POST https://open.tiktokapis.com/v2/post/publish/content/init/
 *     source_info.source = "PULL_FROM_URL" with photo_images array
 *     Up to 35 images per post (carousel).
 *
 *   VIDEO (when payload.mediaUrl is a video, or metadata.videoUrl set):
 *     Step 1 — Init upload
 *       POST https://open.tiktokapis.com/v2/post/publish/video/init/
 *       Returns { publish_id, upload_url }
 *     Step 2 — PUT binary to upload_url
 *     Step 3 — Poll status until PUBLISH_COMPLETE or FAILED
 *       POST https://open.tiktokapis.com/v2/post/publish/status/fetch/
 *
 * Credential storage (social_credentials row, network = 'tiktok'):
 *   access_token  — OAuth 2.0 user access token
 *   metadata      — { openId, imageUrl?, privacyLevel? }
 *
 * Env-var fallbacks (dev / single-tenant):
 *   MARKETER_TIKTOK_ACCESS_TOKEN
 *   MARKETER_TIKTOK_OPEN_ID
 *   MARKETER_TIKTOK_IMAGE_URL   — default image when no payload image
 *
 * API reference: https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
 */

import {
  lookupSocialCredential,
  isTokenExpiredOrExpiringSoon,
  refreshSocialCredential,
} from "../../db/social-credentials.js";
import { stubProviderResult } from "./stub.js";
import { isRateLimited, rateLimitResult } from "./rate-limit.js";
import type { PublishProviderAdapter, PublishProviderInput } from "./types.js";

const API_BASE = "https://open.tiktokapis.com/v2";
const CAPTION_MAX = 2200;

// TikTok privacy levels per Content Posting API
type PrivacyLevel = "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "FOLLOWER_OF_CREATOR" | "SELF_ONLY";

type TikTokCreds = {
  accessToken: string;
  openId: string;
  imageUrl: string | undefined;
  privacyLevel: PrivacyLevel;
};

function resolveCredentials(
  row: import("../../db/social-credentials.js").SocialCredentialRow | undefined,
): TikTokCreds | undefined {
  const token =
    row?.access_token?.trim() ||
    process.env.MARKETER_TIKTOK_ACCESS_TOKEN?.trim();
  const openId =
    (row?.metadata?.["openId"] as string | undefined)?.trim() ||
    process.env.MARKETER_TIKTOK_OPEN_ID?.trim();
  if (!token || !openId) return undefined;

  const imageUrl =
    (row?.metadata?.["imageUrl"] as string | undefined)?.trim() ||
    process.env.MARKETER_TIKTOK_IMAGE_URL?.trim() ||
    undefined;

  const privacyLevel = (
    (row?.metadata?.["privacyLevel"] as string | undefined) ?? "PUBLIC_TO_EVERYONE"
  ) as PrivacyLevel;

  return { accessToken: token, openId, imageUrl, privacyLevel };
}

function pickCaption(input: PublishProviderInput): string {
  const adapted = input.adaptedCopy?.copy?.body?.trim();
  if (adapted) return adapted.slice(0, CAPTION_MAX);
  const raw = input.payload.copy?.body?.trim();
  if (raw) return raw.slice(0, CAPTION_MAX);
  return (input.row?.content_summary?.trim() ?? input.payload.scheduleEntryId).slice(0, CAPTION_MAX);
}

// ── Photo post (PULL_FROM_URL) ───────────────────────────────────────────────

type PhotoInitBody = {
  post_info: {
    title: string;
    privacy_level: PrivacyLevel;
    disable_duet: boolean;
    disable_stitch: boolean;
    disable_comment: boolean;
    brand_content_toggle: boolean;
    brand_organic_toggle: boolean;
  };
  source_info: {
    source: "PULL_FROM_URL";
    photo_images: string[];
    photo_cover_index: number;
  };
};

type ContentInitResponse = {
  data?: { publish_id: string };
  error?: { code: string; message: string; log_id: string };
};

async function publishPhoto(
  creds: TikTokCreds,
  imageUrls: string[],
  caption: string,
): Promise<{ ok: boolean; publishId?: string; detail?: string }> {
  const body: PhotoInitBody = {
    post_info: {
      title: caption,
      privacy_level: creds.privacyLevel,
      disable_duet: false,
      disable_stitch: false,
      disable_comment: false,
      brand_content_toggle: false,
      brand_organic_toggle: false,
    },
    source_info: {
      source: "PULL_FROM_URL",
      photo_images: imageUrls.slice(0, 35),
      photo_cover_index: 0,
    },
  };

  const res = await fetch(`${API_BASE}/post/publish/content/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as ContentInitResponse;
  if (!res.ok || data.error) {
    return { ok: false, detail: data.error?.message ?? `http_${res.status}` };
  }
  return { ok: true, publishId: data.data?.publish_id };
}

// ── Video post (FILE_UPLOAD — 3-step) ────────────────────────────────────────

type VideoInitBody = {
  post_info: {
    title: string;
    privacy_level: PrivacyLevel;
    disable_duet: boolean;
    disable_stitch: boolean;
    disable_comment: boolean;
  };
  source_info: {
    source: "FILE_UPLOAD";
    video_size: number;
    chunk_size: number;
    total_chunk_count: number;
  };
};

type VideoInitResponse = {
  data?: { publish_id: string; upload_url: string };
  error?: { code: string; message: string };
};

type PublishStatusResponse = {
  data?: { status: "PROCESSING_UPLOAD" | "SEND_TO_USER_INBOX" | "FAILED" | "PUBLISH_COMPLETE" };
  error?: { code: string; message: string };
};

async function publishVideo(
  creds: TikTokCreds,
  videoUrl: string,
  caption: string,
): Promise<{ ok: boolean; publishId?: string; detail?: string }> {
  // Fetch the video to get size for upload init
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) return { ok: false, detail: "video_fetch_failed" };

  const videoBuffer = await videoRes.arrayBuffer();
  const videoSize = videoBuffer.byteLength;
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB chunks
  const totalChunks = Math.ceil(videoSize / CHUNK_SIZE);

  // Step 1: Init upload
  const initBody: VideoInitBody = {
    post_info: {
      title: caption,
      privacy_level: creds.privacyLevel,
      disable_duet: false,
      disable_stitch: false,
      disable_comment: false,
    },
    source_info: {
      source: "FILE_UPLOAD",
      video_size: videoSize,
      chunk_size: CHUNK_SIZE,
      total_chunk_count: totalChunks,
    },
  };

  const initRes = await fetch(`${API_BASE}/post/publish/video/init/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${creds.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(initBody),
  });

  const initData = await initRes.json() as VideoInitResponse;
  if (!initRes.ok || initData.error) {
    return { ok: false, detail: initData.error?.message ?? `http_${initRes.status}` };
  }

  const { publish_id: publishId, upload_url: uploadUrl } = initData.data!;

  // Step 2: Upload chunks
  const bytes = new Uint8Array(videoBuffer);
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, videoSize) - 1;
    const chunk = bytes.slice(start, end + 1);

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Range": `bytes ${start}-${end}/${videoSize}`,
        "Content-Length": String(chunk.byteLength),
        "Content-Type": "video/mp4",
      },
      body: chunk,
    });
    if (!uploadRes.ok) {
      return { ok: false, detail: `chunk_upload_failed_${i}:http_${uploadRes.status}` };
    }
  }

  // Step 3: Poll for completion (max 60s)
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await fetch(`${API_BASE}/post/publish/status/fetch/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const statusData = await statusRes.json() as PublishStatusResponse;
    const status = statusData.data?.status;
    if (status === "PUBLISH_COMPLETE") return { ok: true, publishId };
    if (status === "FAILED") return { ok: false, detail: "tiktok_publish_failed" };
  }

  return { ok: false, detail: "tiktok_publish_timeout" };
}

// ── Main provider ─────────────────────────────────────────────────────────────

export const tiktokPublishProvider: PublishProviderAdapter = {
  network: "tiktok",

  async publish(input) {
    if (isRateLimited("tiktok")) return rateLimitResult("tiktok");

    const credRow = await lookupSocialCredential(
      input.payload.tenantId ?? input.row?.tenant_id ?? "",
      "tiktok",
    ).catch(() => undefined);

    if (credRow && isTokenExpiredOrExpiringSoon(credRow)) {
      await refreshSocialCredential(credRow).catch(() => null);
    }

    const freshRow = credRow
      ? await lookupSocialCredential(
          input.payload.tenantId ?? input.row?.tenant_id ?? "",
          "tiktok",
        ).catch(() => undefined)
      : undefined;

    const creds = resolveCredentials(freshRow);
    if (!creds) return stubProviderResult("tiktok", input);

    const caption = pickCaption(input);

    // Prefer video URL from payload, then metadata, then fall back to photo mode
    const videoUrl =
      (input.payload as unknown as Record<string, unknown>)["mediaUrl"] as string | undefined;

    if (videoUrl) {
      const result = await publishVideo(creds, videoUrl, caption);
      return {
        ok: result.ok,
        detail: result.ok ? "tiktok_video_published" : result.detail,
        externalId: result.publishId ? `tiktok:${result.publishId}` : undefined,
      };
    }

    // Photo mode — require at least one image URL
    const imageUrls: string[] = [];
    const payloadImageUrl = (input.payload as unknown as Record<string, unknown>)["imageUrl"] as string | undefined;
    if (payloadImageUrl) imageUrls.push(payloadImageUrl);
    if (creds.imageUrl) imageUrls.push(creds.imageUrl);

    if (!imageUrls.length) {
      return { ok: false, detail: "tiktok_no_image_or_video_url" };
    }

    const result = await publishPhoto(creds, imageUrls, caption);
    return {
      ok: result.ok,
      detail: result.ok ? "tiktok_photo_published" : result.detail,
      externalId: result.publishId ? `tiktok:${result.publishId}` : undefined,
    };
  },
};
