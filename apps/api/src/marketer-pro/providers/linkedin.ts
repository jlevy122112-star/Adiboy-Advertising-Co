/**
 * LinkedIn UGC Posts API provider (Phase 5).
 *
 * Credential storage (social_credentials row, network = 'linkedin'):
 *   access_token  — OAuth 2.0 access token (w/ r_liteprofile + w_member_social scopes)
 *   metadata      — { "authorUrn": "urn:li:person:<id>" }   (member or organization URN)
 *
 * Env-var fallbacks (single-tenant / dev):
 *   MARKETER_LINKEDIN_ACCESS_TOKEN
 *   MARKETER_LINKEDIN_AUTHOR_URN   — e.g. "urn:li:person:AbCdEfGhIj"
 *
 * API reference: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api
 */

import {
  lookupSocialCredential,
  isTokenExpiredOrExpiringSoon,
  refreshSocialCredential,
} from "../../db/social-credentials.js";
import { stubProviderResult } from "./stub.js";
import { isRateLimited, rateLimitResult } from "./rate-limit.js";
import type { PublishProviderAdapter, PublishProviderInput } from "./types.js";

const LINKEDIN_UGC_URL = "https://api.linkedin.com/v2/ugcPosts";

type LinkedInUgcResponse = {
  id?: string;
  message?: string;
  status?: number;
};

function pickText(input: PublishProviderInput): string {
  const adapted = input.adaptedCopy?.copy?.body?.trim();
  if (adapted) return adapted;
  const raw = input.payload.copy?.body?.trim();
  if (raw) return raw;
  return input.row?.content_summary?.trim() ?? input.payload.scheduleEntryId;
}

type LinkedInCreds = {
  accessToken: string;
  authorUrn: string;
};

function resolveLinkedInCreds(
  row: import("../../db/social-credentials.js").SocialCredentialRow | undefined,
): LinkedInCreds | undefined {
  const token =
    row?.access_token?.trim() ||
    process.env.MARKETER_LINKEDIN_ACCESS_TOKEN?.trim();
  const authorUrn =
    (row?.metadata?.["authorUrn"] as string | undefined)?.trim() ||
    process.env.MARKETER_LINKEDIN_AUTHOR_URN?.trim();
  if (!token || !authorUrn) return undefined;
  return { accessToken: token, authorUrn };
}

function buildUgcBody(authorUrn: string, text: string): unknown {
  return {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };
}

export const linkedinPublishProvider: PublishProviderAdapter = {
  network: "linkedin",

  async publish(input) {
    const { payload, context } = input;

    // --- Credential resolution ---
    const credResult = await lookupSocialCredential(payload.tenantId, "linkedin");
    let credRow: import("../../db/social-credentials.js").SocialCredentialRow | undefined;

    if (credResult.mode === "ok") {
      credRow = credResult.row;
      if (isTokenExpiredOrExpiringSoon(credRow)) {
        const refreshed = await refreshSocialCredential(payload.tenantId, "linkedin")
        if (refreshed.ok) credRow = { ...credRow, access_token: refreshed.accessToken }
      }
    } else if (credResult.mode === "error") {
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "linkedin_provider_credential_error",
          tenantId: payload.tenantId,
          message: credResult.message,
        }),
      );
    }

    const creds = resolveLinkedInCreds(credRow);
    if (!creds) {
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "linkedin_provider_no_credential",
          tenantId: payload.tenantId,
          scheduleEntryId: payload.scheduleEntryId,
          hint: "Set MARKETER_LINKEDIN_ACCESS_TOKEN + MARKETER_LINKEDIN_AUTHOR_URN, or upsert social_credentials (network=linkedin).",
        }),
      );
      return stubProviderResult("linkedin", input);
    }

    const text = pickText(input);

    try {
      const res = await fetch(LINKEDIN_UGC_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify(buildUgcBody(creds.authorUrn, text)),
      });

      if (isRateLimited(res)) return rateLimitResult(res, "linkedin")

      const body = (await res.json().catch(() => ({}))) as LinkedInUgcResponse;

      if (!res.ok) {
        const detail = body.message ?? `http_${res.status}`;
        console.error(
          JSON.stringify({
            level: "error",
            event: "linkedin_provider_api_error",
            tenantId: payload.tenantId,
            scheduleEntryId: payload.scheduleEntryId,
            attempt: context.attempt,
            status: res.status,
            detail,
          }),
        );
        return { ok: false, detail: `linkedin_api_error:${detail}` };
      }

      const postId = body.id;
      console.info(
        JSON.stringify({
          level: "info",
          event: "linkedin_provider_published",
          tenantId: payload.tenantId,
          scheduleEntryId: payload.scheduleEntryId,
          postId,
        }),
      );
      return { ok: true, externalId: postId, detail: "linkedin_published" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          level: "error",
          event: "linkedin_provider_fetch_error",
          tenantId: payload.tenantId,
          scheduleEntryId: payload.scheduleEntryId,
          message,
        }),
      );
      return { ok: false, detail: `linkedin_fetch_error:${message.slice(0, 200)}` };
    }
  },
};
