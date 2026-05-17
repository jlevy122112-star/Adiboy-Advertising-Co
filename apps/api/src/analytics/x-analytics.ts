import type { AnalyticsProvider } from "./analytics-provider.js";

export const xAnalyticsProvider: AnalyticsProvider = async ({ externalPostId, accessToken }) => {
  const token = accessToken ?? process.env.MARKETER_X_ACCESS_TOKEN?.trim();
  if (!token) return { ok: false, error: "no_x_access_token" };

  try {
    const res = await fetch(
      `https://api.twitter.com/2/tweets/${externalPostId}?tweet.fields=public_metrics,non_public_metrics`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return { ok: false, error: `x_api_${res.status}` };

    const data = await res.json() as {
      data?: {
        public_metrics?: { impression_count: number; like_count: number; retweet_count: number; reply_count: number; quote_count: number };
        non_public_metrics?: { url_link_clicks: number; impression_count: number };
      };
    };

    const pub = data.data?.public_metrics;
    const priv = data.data?.non_public_metrics;

    return {
      ok: true,
      metrics: {
        impressions: priv?.impression_count ?? pub?.impression_count,
        likes: pub?.like_count,
        shares: pub?.retweet_count,
        comments: pub?.reply_count,
        clicks: priv?.url_link_clicks,
        externalPostStatus: "published",
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "x_fetch_error" };
  }
};
