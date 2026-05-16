/**
 * TikTok Content Posting API provider — documented stub (Phase 5).
 *
 * TikTok's Content Posting API requires:
 *   1. TikTok for Business app — apply at https://developers.tiktok.com/
 *   2. Scopes: video.upload + video.publish (photo.publish for carousels)
 *   3. Partner-program approval before production access is granted
 *
 * Full publishing flow (video):
 *   Step 1 — Init upload
 *     POST https://open.tiktokapis.com/v2/post/publish/video/init/
 *     Headers: Authorization: Bearer {access_token}
 *     Body: { post_info: { title, privacy_level, ... }, source_info: { source: "FILE_UPLOAD", video_size, chunk_size, total_chunk_count } }
 *     Returns: { data: { publish_id, upload_url } }
 *
 *   Step 2 — Upload video chunks
 *     PUT {upload_url}
 *     Headers: Content-Range: bytes {start}-{end}/{total}, Content-Length: {chunk_size}
 *     Body: <binary chunk>
 *
 *   Step 3 — Poll publish status
 *     POST https://open.tiktokapis.com/v2/post/publish/status/fetch/
 *     Body: { publish_id }
 *     Returns: { data: { status: "PROCESSING_UPLOAD" | "PUBLISH_COMPLETE" | ... } }
 *
 * Photo/carousel flow (simpler):
 *   POST https://open.tiktokapis.com/v2/post/publish/content/init/
 *   source_info.source = "PULL_FROM_URL" with photo_images array
 *
 * Credential storage (social_credentials row, network = 'tiktok'):
 *   access_token  — OAuth 2.0 user access token
 *   metadata      — { "openId": "<tiktok-user-open-id>" }
 *
 * Env-var fallbacks (once approved):
 *   MARKETER_TIKTOK_ACCESS_TOKEN
 *   MARKETER_TIKTOK_OPEN_ID
 *
 * This provider returns a stub result until partner credentials are available.
 * Replace the body of `publish` with the 3-step flow above once approved.
 *
 * API reference: https://developers.tiktok.com/doc/content-posting-api-reference-direct-post/
 */

import { createStubProviderAdapter } from "./stub.js";

export const tiktokPublishProvider = createStubProviderAdapter("tiktok");
