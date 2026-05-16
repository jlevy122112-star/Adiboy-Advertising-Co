/**
 * Instagram Content Publishing API provider (Phase 5).
 *
 * Instagram feed posts require a media item. This provider uses the two-step flow:
 *   1. Create a media container  — POST /{ig-user-id}/media
 *   2. Publish the container     — POST /{ig-user-id}/media_publish
 *
 * Credential storage (social_credentials row, network = 'instagram'):
 *   access_token — Instagram User Access Token (w/ instagram_basic + instagram_content_publish)
 *   metadata     — { "igUserId": "<ig-business-account-id>", "imageUrl": "<https://…>" }
 *
 * `metadata.imageUrl` is the default image used when the payload does not supply one.
 * Set it to a brand hero image or evergreen product shot.
 *
 * Env-var fallbacks (single-tenant / dev):
 *   MARKETER_INSTAGRAM_ACCESS_TOKEN
 *   MARKETER_INSTAGRAM_USER_ID
 *   MARKETER_INSTAGRAM_IMAGE_URL  — default image when metadata has none
 *
 * Caption source priority (truncated to 2200 chars — Instagram limit):
 *   adaptedCopy.copy.body → payload.copy.body → row.content_summary → scheduleEntryId
 *
 * Image URL source priority:
 *   metadata.imageUrl → MARKETER_INSTAGRAM_IMAGE_URL
 *   If neither is set → ok: false, detail: 'instagram_no_image_url'
 *
 * API reference: https://developers.facebook.com/docs/instagram-api/guides/content-publishing
 */

import {
  lookupSocialCredential,
  isTokenExpiredOrExpiringSoon,
  refreshSocialCredential,
} from "../../db/social-credentials.js";
import { stubProviderResult } from "./stub.js";
import { isRateLimited, rateLimitResult } from "./rate-limit.js";
import type { PublishProviderAdapter, PublishProviderInput } from "./types.js";

const GRAPH_VERSION = "v19.0";
const CAPTION_MAX = 2200;

type MediaContainerResponse = { id?: string; error?: { message: string; code: number } };
type MediaPublishResponse = { id?: string; error?: { message: string; code: number } };

function mediaUrl(igUserId: string, path: string): string {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/${path}`;
}

function pickCaption(input: PublishProviderInput): string {
  const adapted = input.adaptedCopy?.copy?.body?.trim();
  if (adapted) return adapted.slice(0, CAPTION_MAX);
  const raw = input.payload.copy?.body?.trim();
  if (raw) return raw.slice(0, CAPTION_MAX);
  return (input.row?.content_summary?.trim() ?? input.payload.scheduleEntryId).slice(0, CAPTION_MAX);
}

type InstagramCreds = {
  accessToken: string;
  igUserId: string;
  imageUrl: string | undefined;
};

function resolveInstagramCreds(
  row: import("../../db/social-credentials.js").SocialCredentialRow | undefined,
): InstagramCreds | undefined {
  const token =
    row?.access_token?.trim() ||
    process.env.MARKETER_INSTAGRAM_ACCESS_TOKEN?.trim();
  const igUserId =
    (row?.metadata?.["igUserId"] as string | undefined)?.trim() ||
    process.env.MARKETER_INSTAGRAM_USER_ID?.trim();
  if (!token || !igUserId) return undefined;
  const imageUrl =
    (row?.metadata?.["imageUrl"] as string | undefined)?.trim() ||
    process.env.MARKETER_INSTAGRAM_IMAGE_URL?.trim() ||
    undefined;
  return { accessToken: token, igUserId, imageUrl };
}

export const instagramPublishProvider: PublishProviderAdapter = {
  network: "instagram",

  async publish(input) {
    const { payload, context } = input;

    // --- Credential resolution ---
    const credResult = await lookupSocialCredential(payload.tenantId, "instagram");
    let credRow: import("../../db/social-credentials.js").SocialCredentialRow | undefined;

    if (credResult.mode === "ok") {
      credRow = credResult.row;
      if (isTokenExpiredOrExpiringSoon(credRow)) {
        const refreshed = await refreshSocialCredential(payload.tenantId, "instagram")
        if (refreshed.ok) credRow = { ...credRow, access_token: refreshed.accessToken }
      }
    } else if (credResult.mode === "error") {
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "instagram_provider_credential_error",
          tenantId: payload.tenantId,
          message: credResult.message,
        }),
      );
    }

    const creds = resolveInstagramCreds(credRow);
    if (!creds) {
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "instagram_provider_no_credential",
          tenantId: payload.tenantId,
          scheduleEntryId: payload.scheduleEntryId,
          hint: "Set MARKETER_INSTAGRAM_ACCESS_TOKEN + MARKETER_INSTAGRAM_USER_ID, or upsert social_credentials (network=instagram).",
        }),
      );
      return stubProviderResult("instagram", input);
    }

    // --- Image URL is required for Instagram feed posts ---
    if (!creds.imageUrl) {
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "instagram_provider_no_image_url",
          tenantId: payload.tenantId,
          scheduleEntryId: payload.scheduleEntryId,
          hint: "Set metadata.imageUrl on the social_credentials row or MARKETER_INSTAGRAM_IMAGE_URL env var.",
        }),
      );
      return { ok: false, detail: "instagram_no_image_url" };
    }

    const caption = pickCaption(input);

    try {
      // --- Step 1: Create media container ---
      const containerRes = await fetch(mediaUrl(creds.igUserId, "media"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: creds.imageUrl,
          caption,
          access_token: creds.accessToken,
        }),
      });

      if (isRateLimited(containerRes)) return rateLimitResult(containerRes, "instagram")

      const containerBody = (await containerRes.json().catch(() => ({}))) as MediaContainerResponse;

      if (!containerRes.ok || containerBody.error) {
        const detail = containerBody.error?.message ?? `http_${containerRes.status}`;
        console.error(
          JSON.stringify({
            level: "error",
            event: "instagram_provider_container_error",
            tenantId: payload.tenantId,
            scheduleEntryId: payload.scheduleEntryId,
            attempt: context.attempt,
            status: containerRes.status,
            detail,
          }),
        );
        return { ok: false, detail: `instagram_container_error:${detail}` };
      }

      const creationId = containerBody.id;
      if (!creationId) {
        return { ok: false, detail: "instagram_container_error:missing_creation_id" };
      }

      // --- Step 2: Publish the container ---
      const publishRes = await fetch(mediaUrl(creds.igUserId, "media_publish"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: creationId,
          access_token: creds.accessToken,
        }),
      });

      if (isRateLimited(publishRes)) return rateLimitResult(publishRes, "instagram")

      const publishBody = (await publishRes.json().catch(() => ({}))) as MediaPublishResponse;

      if (!publishRes.ok || publishBody.error) {
        const detail = publishBody.error?.message ?? `http_${publishRes.status}`;
        console.error(
          JSON.stringify({
            level: "error",
            event: "instagram_provider_publish_error",
            tenantId: payload.tenantId,
            scheduleEntryId: payload.scheduleEntryId,
            attempt: context.attempt,
            status: publishRes.status,
            detail,
          }),
        );
        return { ok: false, detail: `instagram_publish_error:${detail}` };
      }

      const postId = publishBody.id;
      console.info(
        JSON.stringify({
          level: "info",
          event: "instagram_provider_published",
          tenantId: payload.tenantId,
          scheduleEntryId: payload.scheduleEntryId,
          postId,
        }),
      );
      return { ok: true, externalId: postId, detail: "instagram_published" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          level: "error",
          event: "instagram_provider_fetch_error",
          tenantId: payload.tenantId,
          scheduleEntryId: payload.scheduleEntryId,
          message,
        }),
      );
      return { ok: false, detail: `instagram_fetch_error:${message.slice(0, 200)}` };
    }
  },
};
