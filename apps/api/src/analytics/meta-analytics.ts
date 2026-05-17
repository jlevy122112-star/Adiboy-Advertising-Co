import type { AnalyticsProvider } from "./analytics-provider.js";

const META_FIELDS = "impressions,reach,engagement,clicks,shares,comments,saved,post_impressions_unique";

export const metaAnalyticsProvider: AnalyticsProvider = async ({ externalPostId, accessToken }) => {
  const token = accessToken ?? process.env.MARKETER_META_ACCESS_TOKEN?.trim();
  if (!token) return { ok: false, error: "no_meta_access_token" };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${externalPostId}/insights?metric=${META_FIELDS}&access_token=${token}`,
    );
    if (!res.ok) return { ok: false, error: `meta_api_${res.status}` };

    const data = await res.json() as { data?: Array<{ name: string; values: Array<{ value: number }> }> };
    const byName: Record<string, number> = {};
    for (const metric of data.data ?? []) {
      byName[metric.name] = metric.values?.[0]?.value ?? 0;
    }

    return {
      ok: true,
      metrics: {
        impressions: byName["impressions"],
        reach: byName["reach"] ?? byName["post_impressions_unique"],
        engagements: byName["engagement"],
        clicks: byName["clicks"],
        shares: byName["shares"],
        comments: byName["comments"],
        saves: byName["saved"],
        externalPostStatus: "published",
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "meta_fetch_error" };
  }
};
