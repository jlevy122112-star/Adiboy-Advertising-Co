import type { AnalyticsProvider } from "./analytics-provider.js";

export const linkedinAnalyticsProvider: AnalyticsProvider = async ({ externalPostId, accessToken }) => {
  const token = accessToken ?? process.env.MARKETER_LINKEDIN_ACCESS_TOKEN?.trim();
  if (!token) return { ok: false, error: "no_linkedin_access_token" };

  try {
    const res = await fetch(
      `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(externalPostId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return { ok: false, error: `linkedin_api_${res.status}` };

    const data = await res.json() as {
      likesSummary?: { totalLikes: number };
      commentsSummary?: { totalFirstLevelComments: number };
      shareStatistics?: { impressionCount: number; clickCount: number; engagement: number; shareCount: number };
    };

    return {
      ok: true,
      metrics: {
        impressions: data.shareStatistics?.impressionCount,
        clicks: data.shareStatistics?.clickCount,
        shares: data.shareStatistics?.shareCount,
        likes: data.likesSummary?.totalLikes,
        comments: data.commentsSummary?.totalFirstLevelComments,
        engagements: data.shareStatistics?.engagement
          ? Math.round((data.shareStatistics.engagement) * (data.shareStatistics.impressionCount ?? 0))
          : undefined,
        externalPostStatus: "published",
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "linkedin_fetch_error" };
  }
};
