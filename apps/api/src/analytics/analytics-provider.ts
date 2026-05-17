/**
 * Analytics provider abstraction.
 * Each provider fetches metrics for a published post from the network API.
 */

import type { AnalyticsNetwork } from "@home-link/marketer-pro-contract";

export type AnalyticsMetrics = {
  impressions?: number;
  reach?: number;
  engagements?: number;
  clicks?: number;
  saves?: number;
  shares?: number;
  comments?: number;
  likes?: number;
  followerDelta?: number;
  watchTimeSeconds?: number;
  viewCount?: number;
  externalPostStatus?: string;
};

export type AnalyticsFetchResult =
  | { ok: true; metrics: AnalyticsMetrics }
  | { ok: false; error: string };

export type AnalyticsProviderArgs = {
  tenantId: string;
  scheduleEntryId: string;
  externalPostId: string;
  network: AnalyticsNetwork;
  accessToken?: string;
};

export type AnalyticsProvider = (args: AnalyticsProviderArgs) => Promise<AnalyticsFetchResult>;

/** Stub provider — returns plausible synthetic data for dev/test */
export function stubAnalyticsProvider(args: AnalyticsProviderArgs): Promise<AnalyticsFetchResult> {
  const seed = args.externalPostId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = (min: number, max: number) => min + (seed % (max - min + 1));
  return Promise.resolve({
    ok: true,
    metrics: {
      impressions: rand(500, 12000),
      reach: rand(400, 10000),
      engagements: rand(20, 800),
      clicks: rand(5, 300),
      shares: rand(1, 60),
      comments: rand(0, 40),
      likes: rand(10, 500),
      saves: rand(0, 80),
      externalPostStatus: "published",
    },
  });
}
