import type { AutonomousRun } from "@home-link/marketer-pro-contract";
import { getPostgresClient } from "../db/postgres.js";

export interface AnalyticsReview {
  topPerformingNetwork: string | null;
  avgEngagementRate: number;
  recommendations: string[];
  shouldOptimize: boolean;
}

export async function runAnalyticsReviewer(run: AutonomousRun): Promise<AnalyticsReview> {
  const sql = getPostgresClient();
  if (!sql) return stubReview();

  try {
    const rows = await sql<Array<{ network: string; avg_eng: string; avg_imp: string; cnt: string }>>`
      SELECT network,
        AVG(engagements) AS avg_eng,
        AVG(impressions) AS avg_imp,
        COUNT(*) AS cnt
      FROM analytics_snapshots
      WHERE tenant_id = ${run.workspaceId}
        AND network = ANY(${run.request.platforms})
        AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY network ORDER BY avg_eng DESC NULLS LAST LIMIT 5
    `;

    if (!rows.length) return stubReview();

    const top = rows[0]!;
    const avgEng  = Number(top.avg_eng ?? 0);
    const avgImp  = Number(top.avg_imp ?? 1);
    const engRate = avgImp > 0 ? (avgEng / avgImp) * 100 : 0;

    const recommendations: string[] = [];
    if (engRate < 1)  recommendations.push(`Engagement rate on ${top.network} is below 1% — consider stronger CTAs`);
    if (engRate > 5)  recommendations.push(`${top.network} is performing exceptionally — increase posting frequency`);
    if (rows.length > 1) {
      const worst = rows[rows.length - 1]!;
      recommendations.push(`${worst.network} is underperforming — review content format and timing`);
    }

    return {
      topPerformingNetwork: top.network,
      avgEngagementRate: Math.round(engRate * 100) / 100,
      recommendations,
      shouldOptimize: engRate < 2,
    };
  } catch { return stubReview(); }
}

function stubReview(): AnalyticsReview {
  return {
    topPerformingNetwork: null,
    avgEngagementRate: 0,
    recommendations: ["Insufficient data — publish more content to get insights"],
    shouldOptimize: false,
  };
}
