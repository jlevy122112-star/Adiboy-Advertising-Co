import { randomUUID } from "node:crypto";
import { getPostgresClient } from "./postgres.js";
import type { AnalyticsSnapshot, AnalyticsSummary, AnalyticsNetwork } from "@home-link/marketer-pro-contract";

type SnapshotRow = {
  id: string; tenant_id: string; schedule_entry_id: string;
  network: string; period: string; external_post_id: string | null;
  external_post_status: string | null; impressions: string | null;
  reach: string | null; engagements: string | null; clicks: string | null;
  saves: string | null; shares: string | null; comments: string | null;
  likes: string | null; follower_delta: string | null;
  watch_time_seconds: string | null; view_count: string | null;
  fetched_at: string; created_at: string;
};

function rowToSnapshot(r: SnapshotRow): AnalyticsSnapshot {
  const n = (v: string | null) => v != null ? Number(v) : undefined;
  return {
    id: r.id, tenantId: r.tenant_id, scheduleEntryId: r.schedule_entry_id,
    network: r.network as AnalyticsNetwork,
    period: r.period as AnalyticsSnapshot["period"],
    externalPostId: r.external_post_id ?? undefined,
    externalPostStatus: r.external_post_status ?? undefined,
    impressions: n(r.impressions), reach: n(r.reach),
    engagements: n(r.engagements), clicks: n(r.clicks),
    saves: n(r.saves), shares: n(r.shares), comments: n(r.comments),
    likes: n(r.likes), followerDelta: n(r.follower_delta),
    watchTimeSeconds: n(r.watch_time_seconds), viewCount: n(r.view_count),
    fetchedAt: r.fetched_at, createdAt: r.created_at,
  };
}

export type UpsertSnapshotInput = Omit<AnalyticsSnapshot, "id" | "createdAt" | "fetchedAt">;

export async function upsertAnalyticsSnapshot(
  input: UpsertSnapshotInput,
): Promise<AnalyticsSnapshot | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<SnapshotRow[]>`
      INSERT INTO analytics_snapshots (
        id, tenant_id, schedule_entry_id, network, period,
        external_post_id, external_post_status,
        impressions, reach, engagements, clicks, saves, shares,
        comments, likes, follower_delta, watch_time_seconds, view_count,
        fetched_at
      ) VALUES (
        ${randomUUID()}, ${input.tenantId}, ${input.scheduleEntryId},
        ${input.network}, ${input.period},
        ${input.externalPostId ?? null}, ${input.externalPostStatus ?? null},
        ${input.impressions ?? null}, ${input.reach ?? null},
        ${input.engagements ?? null}, ${input.clicks ?? null},
        ${input.saves ?? null}, ${input.shares ?? null},
        ${input.comments ?? null}, ${input.likes ?? null},
        ${input.followerDelta ?? null}, ${input.watchTimeSeconds ?? null},
        ${input.viewCount ?? null}, now()
      )
      RETURNING *
    `;
    return rows[0] ? rowToSnapshot(rows[0]) : null;
  } catch { return null; }
}

export async function listAnalyticsSnapshots(args: {
  tenantId: string;
  scheduleEntryId?: string;
  network?: string;
  limit?: number;
}): Promise<AnalyticsSnapshot[]> {
  const sql = getPostgresClient();
  if (!sql) return [];
  const lim = Math.min(args.limit ?? 50, 200);
  try {
    if (args.scheduleEntryId && args.network) {
      return (await sql<SnapshotRow[]>`
        SELECT * FROM analytics_snapshots
        WHERE tenant_id = ${args.tenantId}
          AND schedule_entry_id = ${args.scheduleEntryId}
          AND network = ${args.network}
        ORDER BY fetched_at DESC LIMIT ${lim}
      `).map(rowToSnapshot);
    }
    if (args.scheduleEntryId) {
      return (await sql<SnapshotRow[]>`
        SELECT * FROM analytics_snapshots
        WHERE tenant_id = ${args.tenantId}
          AND schedule_entry_id = ${args.scheduleEntryId}
        ORDER BY fetched_at DESC LIMIT ${lim}
      `).map(rowToSnapshot);
    }
    if (args.network) {
      return (await sql<SnapshotRow[]>`
        SELECT * FROM analytics_snapshots
        WHERE tenant_id = ${args.tenantId} AND network = ${args.network}
        ORDER BY fetched_at DESC LIMIT ${lim}
      `).map(rowToSnapshot);
    }
    return (await sql<SnapshotRow[]>`
      SELECT * FROM analytics_snapshots
      WHERE tenant_id = ${args.tenantId}
      ORDER BY fetched_at DESC LIMIT ${lim}
    `).map(rowToSnapshot);
  } catch { return []; }
}

export async function getAnalyticsSummary(
  tenantId: string,
  network?: AnalyticsNetwork,
): Promise<AnalyticsSummary> {
  const sql = getPostgresClient();
  const empty: AnalyticsSummary = {
    tenantId, network,
    totalImpressions: 0, totalReach: 0, totalEngagements: 0,
    totalClicks: 0, totalShares: 0, totalComments: 0, totalLikes: 0,
    avgEngagementRate: 0, snapshotCount: 0,
  };
  if (!sql) return empty;

  try {
    type SumRow = {
      total_impressions: string; total_reach: string; total_engagements: string;
      total_clicks: string; total_shares: string; total_comments: string;
      total_likes: string; snapshot_count: string; top_post_id: string | null;
    };
    const rows = network
      ? await sql<SumRow[]>`
          SELECT
            COALESCE(SUM(impressions),0)  AS total_impressions,
            COALESCE(SUM(reach),0)        AS total_reach,
            COALESCE(SUM(engagements),0)  AS total_engagements,
            COALESCE(SUM(clicks),0)       AS total_clicks,
            COALESCE(SUM(shares),0)       AS total_shares,
            COALESCE(SUM(comments),0)     AS total_comments,
            COALESCE(SUM(likes),0)        AS total_likes,
            COUNT(*)                      AS snapshot_count,
            (SELECT schedule_entry_id FROM analytics_snapshots
             WHERE tenant_id = ${tenantId} AND network = ${network}
             ORDER BY engagements DESC NULLS LAST LIMIT 1) AS top_post_id
          FROM analytics_snapshots
          WHERE tenant_id = ${tenantId} AND network = ${network}
        `
      : await sql<SumRow[]>`
          SELECT
            COALESCE(SUM(impressions),0)  AS total_impressions,
            COALESCE(SUM(reach),0)        AS total_reach,
            COALESCE(SUM(engagements),0)  AS total_engagements,
            COALESCE(SUM(clicks),0)       AS total_clicks,
            COALESCE(SUM(shares),0)       AS total_shares,
            COALESCE(SUM(comments),0)     AS total_comments,
            COALESCE(SUM(likes),0)        AS total_likes,
            COUNT(*)                      AS snapshot_count,
            (SELECT schedule_entry_id FROM analytics_snapshots
             WHERE tenant_id = ${tenantId}
             ORDER BY engagements DESC NULLS LAST LIMIT 1) AS top_post_id
          FROM analytics_snapshots
          WHERE tenant_id = ${tenantId}
        `;

    const r = rows[0];
    if (!r) return empty;
    const impressions = Number(r.total_impressions);
    const engagements = Number(r.total_engagements);
    return {
      tenantId, network,
      totalImpressions: impressions,
      totalReach: Number(r.total_reach),
      totalEngagements: engagements,
      totalClicks: Number(r.total_clicks),
      totalShares: Number(r.total_shares),
      totalComments: Number(r.total_comments),
      totalLikes: Number(r.total_likes),
      avgEngagementRate: impressions > 0 ? Math.round((engagements / impressions) * 10000) / 100 : 0,
      topPostId: r.top_post_id ?? undefined,
      snapshotCount: Number(r.snapshot_count),
    };
  } catch { return empty; }
}
