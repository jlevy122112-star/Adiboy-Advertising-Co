/**
 * MVP Live Publisher — self-contained, zero queue dependency.
 *
 * Pulls credentials from social_credentials table.
 * Enforces per-platform content spec before every API call.
 *
 * Platform limits:
 *   ig  — caption ≤2200 chars, ≤30 hashtags, image required, alt text via accessibility_caption
 *   fb  — message ≤63k chars (best-practice target ≤500), ≤3 hashtags; photo post when imageUrl present
 *   x   — text ≤280 chars, ≤2 hashtags (text-only MVP; v1.1 media upload = future)
 *   li  — text ≤3000 chars, ≤5 hashtags, authorUrn required
 *   tt  — caption ≤2200 chars, photo carousel PULL_FROM_URL (≤35 images)
 */

import {
  lookupSocialCredential,
  isTokenExpiredOrExpiringSoon,
  refreshSocialCredential,
  type SocialCredentialRow,
} from "../db/social-credentials.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MvpPlatform = "ig" | "fb" | "x" | "li" | "tt";

export interface MvpPublishInput {
  platform: MvpPlatform;
  content: string;       // raw generated post content (may include inline #hashtags)
  imageUrl?: string;     // DALL-E 3 or CDN URL
  hashtags?: string[];   // without # prefix
  topic?: string;        // used as fallback alt text
  altText?: string;      // explicit accessibility description for image
}

export interface MvpPublishResult {
  platform: MvpPlatform;
  ok: boolean;
  externalId?: string;
  detail: string;
  optimizedContent: string;  // what was actually sent to the API
  warnings: string[];        // applied truncations / adjustments
}

interface OptimizedContent {
  text: string;
  warnings: string[];
}

// ─── Platform limit table ─────────────────────────────────────────────────────

const LIMITS: Record<MvpPlatform, { textMax: number; hashtagMax: number }> = {
  ig: { textMax: 2200, hashtagMax: 30 },
  fb: { textMax: 63206, hashtagMax: 3 },
  x:  { textMax: 280,  hashtagMax: 2 },
  li: { textMax: 3000, hashtagMax: 5 },
  tt: { textMax: 2200, hashtagMax: 20 },
};

// ─── Content optimizer ────────────────────────────────────────────────────────

function extractInlineHashtags(text: string): string[] {
  return [...text.matchAll(/#(\w+)/g)].map(m => m[1]!);
}

function stripInlineHashtags(text: string): string {
  return text.replace(/(^|\s)#\w+/g, " ").replace(/\s{2,}/g, " ").trim();
}

function optimizeContent(
  platform: MvpPlatform,
  content: string,
  extra: string[],
): OptimizedContent {
  const { textMax, hashtagMax } = LIMITS[platform];
  const warnings: string[] = [];

  const inline = extractInlineHashtags(content);
  const base = inline.length > 0 ? stripInlineHashtags(content) : content;
  const allTags = [...new Set([...inline, ...extra])];

  let tags = allTags;
  if (tags.length > hashtagMax) {
    tags = tags.slice(0, hashtagMax);
    warnings.push(`hashtags_capped:${allTags.length}→${hashtagMax}`);
  }

  const tagStr = tags.map(t => `#${t}`).join(" ");
  const sep = tagStr ? "\n\n" : "";
  const maxBody = textMax - sep.length - tagStr.length;

  let body = base;
  if (body.length > maxBody) {
    body = body.slice(0, maxBody - 3) + "...";
    warnings.push(`text_truncated:${base.length}→${maxBody}`);
  }

  if (platform === "fb" && body.length > 500) {
    warnings.push("fb_tip:text>500_chars_may_reduce_organic_reach");
  }

  return { text: tagStr ? `${body}${sep}${tagStr}` : body, warnings };
}

// ─── Retry / backoff helper ───────────────────────────────────────────────────

const RETRY_DELAYS_MS = [0, 800, 2400]; // attempt 1 immediate, 2 after 0.8s, 3 after 2.4s

/**
 * Retry a fetch-based API call up to 3 times with exponential backoff.
 * Only retries on 429 (rate limit) or 5xx (server error) — never on 4xx auth failures.
 */
async function withRetry<T>(
  fn: () => Promise<{ status: number; body: T }>,
): Promise<{ status: number; body: T }> {
  let last!: { status: number; body: T };
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    last = await fn();
    const { status } = last;
    if (status < 500 && status !== 429) return last; // success or non-retryable client error
  }
  return last;
}

async function fetchJson<T>(
  url: string,
  init: RequestInit,
): Promise<{ status: number; body: T }> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({})) as T;
  return { status: res.status, body };
}

// ─── Credential helper ────────────────────────────────────────────────────────

async function freshCred(tenantId: string, network: string): Promise<SocialCredentialRow | null> {
  const result = await lookupSocialCredential(tenantId, network);
  if (result.mode !== "ok") return null;
  let row = result.row;
  if (isTokenExpiredOrExpiringSoon(row)) {
    const r = await refreshSocialCredential(tenantId, network);
    if (r.ok) row = { ...row, access_token: r.accessToken };
  }
  return row;
}

// ── SSRF guard for image URLs passed to platform APIs ─────────────────────────
// Platform APIs (Meta, TikTok) will fetch imageUrl server-to-server.
// Validate it's a public HTTPS URL — not an internal address.
function isSafePublicUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const h = u.hostname;
    if (h === "localhost" || h === "127.0.0.1") return false;
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(h)) return false;
    return true;
  } catch { return false; }
}

function err(platform: MvpPlatform, detail: string, optimized: OptimizedContent): MvpPublishResult {
  return { platform, ok: false, detail, optimizedContent: optimized.text, warnings: optimized.warnings };
}

function ok(platform: MvpPlatform, externalId: string | undefined, detail: string, optimized: OptimizedContent): MvpPublishResult {
  return { platform, ok: true, externalId, detail, optimizedContent: optimized.text, warnings: optimized.warnings };
}

// ─── Instagram (two-step container → publish) ─────────────────────────────────

const GV = "v19.0";

type FbJson = { id?: string; error?: { message: string } };

async function igCreateContainer(
  token: string, igUserId: string, imageUrl: string, caption: string, alt: string,
): Promise<FbJson> {
  const { body } = await withRetry(() => fetchJson<FbJson>(
    `https://graph.facebook.com/${GV}/${igUserId}/media`,
    { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, caption, accessibility_caption: alt.slice(0, 500), access_token: token }) },
  ));
  return body;
}

async function igPublishContainer(
  token: string, igUserId: string, creationId: string,
): Promise<FbJson> {
  const { body } = await withRetry(() => fetchJson<FbJson>(
    `https://graph.facebook.com/${GV}/${igUserId}/media_publish`,
    { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: creationId, access_token: token }) },
  ));
  return body;
}

async function publishInstagram(
  tenantId: string, optimized: OptimizedContent, imageUrl: string, altText: string,
): Promise<MvpPublishResult> {
  const p: MvpPlatform = "ig";
  const row = await freshCred(tenantId, "instagram");
  const token = row?.access_token?.trim() || process.env.MARKETER_INSTAGRAM_ACCESS_TOKEN?.trim();
  const uid = (row?.metadata?.["igUserId"] as string | undefined)?.trim() || process.env.MARKETER_INSTAGRAM_USER_ID?.trim();
  const img = imageUrl || (row?.metadata?.["imageUrl"] as string | undefined)?.trim() || process.env.MARKETER_INSTAGRAM_IMAGE_URL?.trim();

  if (!token || !uid) return err(p, "ig_no_credentials", optimized);
  if (!img) return err(p, "ig_no_image_url", optimized);

  try {
    const containerJson = await igCreateContainer(token, uid, img, optimized.text, altText);
    if (containerJson.error || !containerJson.id) {
      return err(p, `ig_container_error:${containerJson.error?.message ?? "no_id"}`, optimized);
    }
    const publishJson = await igPublishContainer(token, uid, containerJson.id);
    if (publishJson.error) return err(p, `ig_publish_error:${publishJson.error.message}`, optimized);
    return ok(p, publishJson.id, "instagram_published", optimized);
  } catch (e) {
    return err(p, `ig_error:${String(e).slice(0, 200)}`, optimized);
  }
}

// ─── Facebook ─────────────────────────────────────────────────────────────────

async function publishFacebook(
  tenantId: string, optimized: OptimizedContent, imageUrl?: string,
): Promise<MvpPublishResult> {
  const p: MvpPlatform = "fb";
  const row = await freshCred(tenantId, "meta");
  const token = row?.access_token?.trim() || process.env.MARKETER_META_ACCESS_TOKEN?.trim();
  const pageId = (row?.metadata?.["pageId"] as string | undefined)?.trim() || process.env.MARKETER_META_PAGE_ID?.trim();

  if (!token || !pageId) return err(p, "fb_no_credentials", optimized);

  const base = `https://graph.facebook.com/${GV}/${pageId}`;

  try {
    if (imageUrl) {
      const { status, body: j } = await withRetry(() => fetchJson<FbJson>(`${base}/photos`,
        { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: imageUrl, caption: optimized.text, access_token: token }) }));
      if (status >= 400 || j.error) return err(p, `fb_photo_error:${j.error?.message ?? status}`, optimized);
      return ok(p, j.id, "facebook_photo_published", optimized);
    }

    const { status, body: j } = await withRetry(() => fetchJson<FbJson>(`${base}/feed`,
      { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: optimized.text, access_token: token }) }));
    if (status >= 400 || j.error) return err(p, `fb_feed_error:${j.error?.message ?? status}`, optimized);
    return ok(p, j.id, "facebook_published", optimized);
  } catch (e) {
    return err(p, `fb_error:${String(e).slice(0, 200)}`, optimized);
  }
}

// ─── X / Twitter ──────────────────────────────────────────────────────────────

async function publishX(
  tenantId: string, optimized: OptimizedContent,
): Promise<MvpPublishResult> {
  const p: MvpPlatform = "x";
  const row = await freshCred(tenantId, "x");
  const token = row?.access_token?.trim() || process.env.MARKETER_X_ACCESS_TOKEN?.trim();

  if (!token) return err(p, "x_no_credentials", optimized);

  try {
    type XJson = { data?: { id: string }; errors?: { message: string }[] };
    const { status, body: j } = await withRetry(() => fetchJson<XJson>(
      "https://api.twitter.com/2/tweets",
      { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: optimized.text }) },
    ));
    if (status >= 400 || j.errors?.length) return err(p, `x_error:${j.errors?.[0]?.message ?? status}`, optimized);
    return ok(p, j.data?.id, "x_published", optimized);
  } catch (e) {
    return err(p, `x_error:${String(e).slice(0, 200)}`, optimized);
  }
}

// ─── LinkedIn ─────────────────────────────────────────────────────────────────

async function publishLinkedIn(
  tenantId: string, optimized: OptimizedContent,
): Promise<MvpPublishResult> {
  const p: MvpPlatform = "li";
  const row = await freshCred(tenantId, "linkedin");
  const token = row?.access_token?.trim() || process.env.MARKETER_LINKEDIN_ACCESS_TOKEN?.trim();
  const urn = (row?.metadata?.["authorUrn"] as string | undefined)?.trim() || process.env.MARKETER_LINKEDIN_AUTHOR_URN?.trim();

  if (!token || !urn) return err(p, "li_no_credentials", optimized);

  const body = {
    author: urn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: optimized.text },
        shareMediaCategory: "NONE",
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };

  try {
    type LiJson = { id?: string; message?: string };
    const { status, body: j } = await withRetry(() => fetchJson<LiJson>(
      "https://api.linkedin.com/v2/ugcPosts",
      { method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Restli-Protocol-Version": "2.0.0" },
        body: JSON.stringify(body) },
    ));
    if (status >= 400) return err(p, `li_error:${j.message ?? status}`, optimized);
    return ok(p, j.id, "linkedin_published", optimized);
  } catch (e) {
    return err(p, `li_error:${String(e).slice(0, 200)}`, optimized);
  }
}

// ─── TikTok (photo carousel) ──────────────────────────────────────────────────

async function publishTikTok(
  tenantId: string, optimized: OptimizedContent, imageUrl?: string,
): Promise<MvpPublishResult> {
  const p: MvpPlatform = "tt";
  const row = await freshCred(tenantId, "tiktok");
  const token = row?.access_token?.trim() || process.env.MARKETER_TIKTOK_ACCESS_TOKEN?.trim();
  const openId = (row?.metadata?.["openId"] as string | undefined)?.trim() || process.env.MARKETER_TIKTOK_OPEN_ID?.trim();
  const img = imageUrl || (row?.metadata?.["imageUrl"] as string | undefined)?.trim() || process.env.MARKETER_TIKTOK_IMAGE_URL?.trim();
  const privacy = (row?.metadata?.["privacyLevel"] as string | undefined) ?? "PUBLIC_TO_EVERYONE";

  if (!token || !openId) return err(p, "tt_no_credentials", optimized);
  if (!img) return err(p, "tt_no_image_url", optimized);

  const body = {
    post_info: {
      title: optimized.text,
      privacy_level: privacy,
      disable_duet: false, disable_stitch: false,
      disable_comment: false, brand_content_toggle: false, brand_organic_toggle: false,
    },
    source_info: { source: "PULL_FROM_URL", photo_images: [img], photo_cover_index: 0 },
  };

  try {
    type TtJson = { data?: { publish_id: string }; error?: { message: string } };
    const { status, body: j } = await withRetry(() => fetchJson<TtJson>(
      "https://open.tiktokapis.com/v2/post/publish/content/init/",
      { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify(body) },
    ));
    if (status >= 400 || j.error) return err(p, `tt_error:${j.error?.message ?? status}`, optimized);
    return ok(p, j.data?.publish_id ? `tiktok:${j.data.publish_id}` : undefined, "tiktok_published", optimized);
  } catch (e) {
    return err(p, `tt_error:${String(e).slice(0, 200)}`, optimized);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function publishPost(tenantId: string, input: MvpPublishInput): Promise<MvpPublishResult> {
  const optimized = optimizeContent(input.platform, input.content, input.hashtags ?? []);
  const alt = input.altText ?? input.topic ?? input.content.slice(0, 200);

  // imageUrl must be a public HTTPS URL — validate before passing to platform APIs
  const imageUrl = input.imageUrl && isSafePublicUrl(input.imageUrl) ? input.imageUrl : undefined;
  if (input.imageUrl && !imageUrl) {
    optimized.warnings.push("image_url_blocked:not_a_safe_public_https_url");
  }

  switch (input.platform) {
    case "ig": return publishInstagram(tenantId, optimized, imageUrl ?? "", alt);
    case "fb": return publishFacebook(tenantId, optimized, imageUrl);
    case "x":  return publishX(tenantId, optimized);
    case "li": return publishLinkedIn(tenantId, optimized);
    case "tt": return publishTikTok(tenantId, optimized, imageUrl);
  }
}

export async function publishAll(tenantId: string, posts: MvpPublishInput[]): Promise<MvpPublishResult[]> {
  const results = await Promise.allSettled(posts.map(p => publishPost(tenantId, p)));
  return results.map((r, i): MvpPublishResult => {
    if (r.status === "fulfilled") return r.value;
    return {
      platform: posts[i]!.platform,
      ok: false,
      detail: `publish_crash:${String(r.reason).slice(0, 200)}`,
      optimizedContent: posts[i]!.content,
      warnings: [],
    };
  });
}
