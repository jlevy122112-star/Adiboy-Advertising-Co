/**
 * TikTok video analytics provider.
 *
 * Fetches per-video metrics using the TikTok Research API / Video Query endpoint.
 * Requires scope: video.list
 *
 * API reference: https://developers.tiktok.com/doc/research-api-specs-query-videos
 */

import type { AnalyticsFetchResult, AnalyticsProvider, AnalyticsProviderArgs } from "./analytics-provider.js";

const API_BASE = "https://open.tiktokapis.com/v2";

const VIDEO_FIELDS = [
  "id",
  "view_count",
  "like_count",
  "comment_count",
  "share_count",
  "play_url",
].join(",");

type VideoData = {
  id?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  play_url?: string;
};

type VideoQueryResponse = {
  data?: {
    videos?: VideoData[];
  };
  error?: { code: string; message: string };
};

async function fetchTikTokVideoStats(
  accessToken: string,
  videoId: string,
): Promise<AnalyticsFetchResult> {
  const res = await fetch(`${API_BASE}/video/query/?fields=${encodeURIComponent(VIDEO_FIELDS)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      filters: { video_ids: [videoId] },
    }),
  });

  if (!res.ok) {
    return { ok: false, error: `tiktok_analytics_http_${res.status}` };
  }

  const data = await res.json() as VideoQueryResponse;
  if (data.error) {
    return { ok: false, error: `tiktok_analytics_api:${data.error.code}` };
  }

  const video = data.data?.videos?.[0];
  if (!video) {
    return { ok: false, error: "tiktok_video_not_found" };
  }

  return {
    ok: true,
    metrics: {
      viewCount: video.view_count,
      likes: video.like_count,
      comments: video.comment_count,
      shares: video.share_count,
      externalPostStatus: "published",
    },
  };
}

export const tiktokAnalyticsProvider: AnalyticsProvider = async (
  args: AnalyticsProviderArgs,
): Promise<AnalyticsFetchResult> => {
  const accessToken =
    args.accessToken?.trim() ||
    process.env.MARKETER_TIKTOK_ACCESS_TOKEN?.trim();

  if (!accessToken) {
    return { ok: false, error: "tiktok_no_access_token" };
  }

  // externalPostId format: "tiktok:{publish_id}" or raw video id
  const videoId = args.externalPostId.startsWith("tiktok:")
    ? args.externalPostId.slice(7)
    : args.externalPostId;

  return fetchTikTokVideoStats(accessToken, videoId);
};
