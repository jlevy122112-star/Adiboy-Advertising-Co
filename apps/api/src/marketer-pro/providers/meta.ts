/**
 * Meta Graph API provider — Facebook Page feed posts (Phase 5).
 *
 * Credential storage (social_credentials row, network = 'meta'):
 *   access_token  — Page Access Token (long-lived, obtained via OAuth + token exchange)
 *   metadata      — { "pageId": "<facebook-page-id>", "igUserId": "<instagram-user-id>" }
 *                   igUserId is optional; only needed for Instagram publishing (future).
 *
 * Env-var fallbacks (single-tenant / dev):
 *   MARKETER_META_ACCESS_TOKEN   — Page Access Token
 *   MARKETER_META_PAGE_ID        — Facebook Page ID
 *
 * API reference: https://developers.facebook.com/docs/graph-api/reference/page/feed/
 *
 * Instagram note: Instagram Business publishing uses a two-step container/publish
 * flow (POST /{ig-user-id}/media then /{ig-user-id}/media_publish). That is handled
 * by the separate 'instagram' route once igUserId is available in metadata.
 */

import { lookupSocialCredential } from "../../db/social-credentials.js";
import { stubProviderResult } from "./stub.js";
import type { PublishProviderAdapter, PublishProviderInput } from "./types.js";

const GRAPH_VERSION = "v19.0";

type GraphFeedResponse = {
  id?: string;
  error?: { message: string; code: number };
};

function pickMessage(input: PublishProviderInput): string {
  const adapted = input.adaptedCopy?.copy?.body?.trim();
  if (adapted) return adapted;
  const raw = input.payload.copy?.body?.trim();
  if (raw) return raw;
  return input.row?.content_summary?.trim() ?? input.payload.scheduleEntryId;
}

function metaPageUrl(pageId: string): string {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/feed`;
}

type MetaCreds = {
  accessToken: string;
  pageId: string;
};

function resolveMetaCreds(
  row: import("../../db/social-credentials.js").SocialCredentialRow | undefined,
): MetaCreds | undefined {
  const token =
    row?.access_token?.trim() ||
    process.env.MARKETER_META_ACCESS_TOKEN?.trim();
  const pageId =
    (row?.metadata?.["pageId"] as string | undefined)?.trim() ||
    process.env.MARKETER_META_PAGE_ID?.trim();
  if (!token || !pageId) return undefined;
  return { accessToken: token, pageId };
}

export const metaPublishProvider: PublishProviderAdapter = {
  network: "meta",

  async publish(input) {
    const { payload, context } = input;

    // --- Credential resolution ---
    const credResult = await lookupSocialCredential(payload.tenantId, "meta");
    let credRow: import("../../db/social-credentials.js").SocialCredentialRow | undefined;

    if (credResult.mode === "ok") {
      credRow = credResult.row;
    } else if (credResult.mode === "error") {
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "meta_provider_credential_error",
          tenantId: payload.tenantId,
          message: credResult.message,
        }),
      );
    }

    const creds = resolveMetaCreds(credRow);
    if (!creds) {
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "meta_provider_no_credential",
          tenantId: payload.tenantId,
          scheduleEntryId: payload.scheduleEntryId,
          hint: "Set MARKETER_META_ACCESS_TOKEN + MARKETER_META_PAGE_ID, or upsert social_credentials (network=meta).",
        }),
      );
      return stubProviderResult("meta", input);
    }

    const message = pickMessage(input);
    const url = metaPageUrl(creds.pageId);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          access_token: creds.accessToken,
        }),
      });

      const body = (await res.json().catch(() => ({}))) as GraphFeedResponse;

      if (!res.ok || body.error) {
        const detail = body.error?.message ?? `http_${res.status}`;
        console.error(
          JSON.stringify({
            level: "error",
            event: "meta_provider_api_error",
            tenantId: payload.tenantId,
            scheduleEntryId: payload.scheduleEntryId,
            attempt: context.attempt,
            status: res.status,
            detail,
          }),
        );
        return { ok: false, detail: `meta_api_error:${detail}` };
      }

      const postId = body.id;
      console.info(
        JSON.stringify({
          level: "info",
          event: "meta_provider_published",
          tenantId: payload.tenantId,
          scheduleEntryId: payload.scheduleEntryId,
          postId,
        }),
      );
      return { ok: true, externalId: postId, detail: "meta_published" };
    } catch (err) {
      const message_ = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          level: "error",
          event: "meta_provider_fetch_error",
          tenantId: payload.tenantId,
          scheduleEntryId: payload.scheduleEntryId,
          message: message_,
        }),
      );
      return { ok: false, detail: `meta_fetch_error:${message_.slice(0, 200)}` };
    }
  },
};
