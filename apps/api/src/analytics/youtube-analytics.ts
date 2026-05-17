import type { AnalyticsProvider } from "./analytics-provider.js";

export const youtubeAnalyticsProvider: AnalyticsProvider = async ({ externalPostId, accessToken }) => {
  const token = accessToken ?? process.env.MARKETER_YOUTUBE_ACCESS_TOKEN?.trim();
  if (!token) return { ok: false, error: "no_youtube_access_token" };

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${externalPostId}&part=statistics`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return { ok: false, error: `youtube_api_${res.status}` };

    const data = await res.json() as {
      items?: Array<{
        statistics?: {
          viewCount: string; likeCount: string; commentCount: string;
          favoriteCount: string; dislikeCount?: string;
        };
      }>;
    };

    const stats = data.items?.[0]?.statistics;
    if (!stats) return { ok: false, error: "youtube_no_stats" };

    return {
      ok: true,
      metrics: {
        viewCount: Number(stats.viewCount),
        impressions: Number(stats.viewCount),
        likes: Number(stats.likeCount),
        comments: Number(stats.commentCount),
        saves: Number(stats.favoriteCount),
        externalPostStatus: "published",
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "youtube_fetch_error" };
  }
};
