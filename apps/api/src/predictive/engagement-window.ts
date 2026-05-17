/**
 * Analyze historical analytics_snapshots to find peak engagement windows
 * for a given tenant + network. Returns per (dayOfWeek, hourUTC) scores.
 */

import { getPostgresClient } from "../db/postgres.js";

export interface EngagementWindow {
  dayOfWeek: number;
  hourUTC: number;
  avgEngagements: number;
  avgImpressions: number;
  sampleCount: number;
  engagementRate: number; // engagements / impressions
}

export async function getHistoricalEngagementWindows(
  tenantId: string,
  network?: string,
): Promise<EngagementWindow[]> {
  const sql = getPostgresClient();
  if (!sql) return [];

  try {
    type Row = {
      dow: string; hour: string;
      avg_eng: string | null; avg_imp: string | null; cnt: string;
    };

    let rows: Row[];
    if (network) {
      rows = await sql<Row[]>`
        SELECT
          EXTRACT(DOW  FROM fetched_at)::int AS dow,
          EXTRACT(HOUR FROM fetched_at)::int AS hour,
          AVG(engagements) AS avg_eng,
          AVG(impressions) AS avg_imp,
          COUNT(*)         AS cnt
        FROM analytics_snapshots
        WHERE tenant_id = ${tenantId} AND network = ${network}
          AND engagements IS NOT NULL
        GROUP BY dow, hour
        ORDER BY dow, hour
      `;
    } else {
      rows = await sql<Row[]>`
        SELECT
          EXTRACT(DOW  FROM fetched_at)::int AS dow,
          EXTRACT(HOUR FROM fetched_at)::int AS hour,
          AVG(engagements) AS avg_eng,
          AVG(impressions) AS avg_imp,
          COUNT(*)         AS cnt
        FROM analytics_snapshots
        WHERE tenant_id = ${tenantId} AND engagements IS NOT NULL
        GROUP BY dow, hour
        ORDER BY dow, hour
      `;
    }

    return rows.map(r => {
      const avgEng = r.avg_eng != null ? Number(r.avg_eng) : 0;
      const avgImp = r.avg_imp != null ? Number(r.avg_imp) : 0;
      return {
        dayOfWeek: Number(r.dow),
        hourUTC: Number(r.hour),
        avgEngagements: avgEng,
        avgImpressions: avgImp,
        sampleCount: Number(r.cnt),
        engagementRate: avgImp > 0 ? avgEng / avgImp : 0,
      };
    });
  } catch { return []; }
}

/** Normalize a list of windows into 0–100 scores. */
export function normalizeEngagementScores(
  windows: EngagementWindow[],
): Map<string, number> {
  const scores = new Map<string, number>();
  if (!windows.length) return scores;

  const maxRate = Math.max(...windows.map(w => w.engagementRate), 0.0001);
  for (const w of windows) {
    const key = `${w.dayOfWeek}:${w.hourUTC}`;
    scores.set(key, Math.round((w.engagementRate / maxRate) * 100));
  }
  return scores;
}
