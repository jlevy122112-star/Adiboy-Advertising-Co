/**
 * X (Twitter) API v2 provider — OAuth 2.0 user-context tweet creation.
 *
 * Credential storage (social_credentials row, network = 'x'):
 *   access_token  — OAuth 2.0 user access token (PKCE or confidential client flow)
 *   token_secret  — unused for OAuth 2.0; populated only for legacy OAuth 1.0a tokens
 *   metadata      — {} (no extra fields required for basic tweet creation)
 *
 * Env-var fallback (single-tenant / dev): MARKETER_X_ACCESS_TOKEN
 *
 * API reference: https://developer.twitter.com/en/docs/twitter-api/tweets/manage-tweets/api-reference/post-tweets
 */

import {
  lookupSocialCredential,
  isTokenExpiredOrExpiringSoon,
  refreshSocialCredential,
} from "../../db/social-credentials.js";
import { stubProviderResult } from "./stub.js";
import { isRateLimited, rateLimitResult } from "./rate-limit.js";
import type { PublishProviderAdapter, PublishProviderInput } from "./types.js";

const X_TWEETS_URL = "https://api.twitter.com/2/tweets";

type XTweetResponse = {
  data?: { id: string; text: string };
  errors?: { message: string }[];
};

function resolveAccessToken(
  tenantCredToken: string | undefined,
): string | undefined {
  return tenantCredToken ?? (process.env.MARKETER_X_ACCESS_TOKEN?.trim() || undefined);
}

function pickText(input: PublishProviderInput): string {
  const adapted = input.adaptedCopy?.copy?.body?.trim();
  if (adapted) return adapted;
  const raw = input.payload.copy?.body?.trim();
  if (raw) return raw;
  return input.row?.content_summary?.trim() ?? input.payload.scheduleEntryId;
}

export const xPublishProvider: PublishProviderAdapter = {
  network: "x",

  async publish(input) {
    const { payload, context } = input;

    // --- Credential resolution ---
    const credResult = await lookupSocialCredential(payload.tenantId, "x");
    let accessToken: string | undefined;

    if (credResult.mode === "ok") {
      let row = credResult.row
      if (isTokenExpiredOrExpiringSoon(row)) {
        const refreshed = await refreshSocialCredential(payload.tenantId, "x")
        if (refreshed.ok) row = { ...row, access_token: refreshed.accessToken }
      }
      accessToken = resolveAccessToken(row.access_token);
    } else if (credResult.mode === "not_found" || credResult.mode === "no_database") {
      accessToken = resolveAccessToken(undefined);
    } else {
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "x_provider_credential_error",
          tenantId: payload.tenantId,
          message: credResult.message,
        }),
      );
      accessToken = resolveAccessToken(undefined);
    }

    if (!accessToken) {
      console.warn(
        JSON.stringify({
          level: "warn",
          event: "x_provider_no_credential",
          tenantId: payload.tenantId,
          scheduleEntryId: payload.scheduleEntryId,
          hint: "Set MARKETER_X_ACCESS_TOKEN or upsert a social_credentials row (network=x).",
        }),
      );
      return stubProviderResult("x", input);
    }

    // --- Build tweet text (X limit: 280 chars) ---
    const text = pickText(input).slice(0, 280);

    // --- POST to X API v2 ---
    try {
      const res = await fetch(X_TWEETS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (isRateLimited(res)) return rateLimitResult(res, "x")

      const body = (await res.json().catch(() => ({}))) as XTweetResponse;

      if (!res.ok || body.errors?.length) {
        const detail = body.errors?.[0]?.message ?? `http_${res.status}`;
        console.error(
          JSON.stringify({
            level: "error",
            event: "x_provider_api_error",
            tenantId: payload.tenantId,
            scheduleEntryId: payload.scheduleEntryId,
            attempt: context.attempt,
            status: res.status,
            detail,
          }),
        );
        return { ok: false, detail: `x_api_error:${detail}` };
      }

      const tweetId = body.data?.id;
      console.info(
        JSON.stringify({
          level: "info",
          event: "x_provider_published",
          tenantId: payload.tenantId,
          scheduleEntryId: payload.scheduleEntryId,
          tweetId,
        }),
      );
      return { ok: true, externalId: tweetId, detail: "x_published" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          level: "error",
          event: "x_provider_fetch_error",
          tenantId: payload.tenantId,
          scheduleEntryId: payload.scheduleEntryId,
          message,
        }),
      );
      return { ok: false, detail: `x_fetch_error:${message.slice(0, 200)}` };
    }
  },
};
