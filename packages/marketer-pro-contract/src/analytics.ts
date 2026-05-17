/**
 * Phase 10 — Analytics ingestion contracts.
 */

import { z } from "zod";

export const AnalyticsNetworkSchema = z.enum([
  "facebook", "instagram", "x", "linkedin", "youtube", "tiktok", "generic",
]);
export type AnalyticsNetwork = z.infer<typeof AnalyticsNetworkSchema>;

export const AnalyticsPeriodSchema = z.enum(["lifetime", "day", "week", "month"]);
export type AnalyticsPeriod = z.infer<typeof AnalyticsPeriodSchema>;

export const AnalyticsSnapshotSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  scheduleEntryId: z.string(),
  network: AnalyticsNetworkSchema,
  period: AnalyticsPeriodSchema,
  externalPostId: z.string().optional(),
  externalPostStatus: z.string().optional(),

  // Core metrics — all optional since not every platform exposes all
  impressions: z.number().int().optional(),
  reach: z.number().int().optional(),
  engagements: z.number().int().optional(),
  clicks: z.number().int().optional(),
  saves: z.number().int().optional(),
  shares: z.number().int().optional(),
  comments: z.number().int().optional(),
  likes: z.number().int().optional(),
  followerDelta: z.number().int().optional(),
  watchTimeSeconds: z.number().optional(),
  viewCount: z.number().int().optional(),

  fetchedAt: z.string(),
  createdAt: z.string(),
});
export type AnalyticsSnapshot = z.infer<typeof AnalyticsSnapshotSchema>;

export const AnalyticsSummarySchema = z.object({
  tenantId: z.string(),
  network: AnalyticsNetworkSchema.optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  totalImpressions: z.number(),
  totalReach: z.number(),
  totalEngagements: z.number(),
  totalClicks: z.number(),
  totalShares: z.number(),
  totalComments: z.number(),
  totalLikes: z.number(),
  avgEngagementRate: z.number(),
  topPostId: z.string().optional(),
  snapshotCount: z.number(),
});
export type AnalyticsSummary = z.infer<typeof AnalyticsSummarySchema>;
