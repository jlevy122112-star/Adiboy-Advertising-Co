import type { AnomalyEvent, AnomalyType } from "@home-link/marketer-pro-contract";
import { getPostgresClient } from "../db/postgres.js";
import { randomUUID } from "crypto";

const PUBLISH_SPIKE_THRESHOLD = 3;
const OFF_HOURS_START = 22;
const OFF_HOURS_END = 6;
const RAPID_FAIL_WINDOW_MS = 5 * 60 * 1000;
const RAPID_FAIL_MIN = 5;

async function detectPublishVolumeSpike(workspaceId: string): Promise<AnomalyEvent | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  const rows = await sql`
    SELECT
      COUNT(*) FILTER (WHERE published_at > now() - interval '1 hour') as recent_hour,
      COUNT(*) FILTER (WHERE published_at > now() - interval '7 days') / 168.0 as avg_hourly
    FROM scheduled_posts
    WHERE workspace_id = ${workspaceId}
      AND published_at IS NOT NULL
      AND published_at > now() - interval '7 days'
  `;
  const row = rows[0];
  if (!row) return null;
  const recent = Number(row.recent_hour ?? 0);
  const avg = Number(row.avg_hourly ?? 0);
  if (avg < 1 || recent < avg * PUBLISH_SPIKE_THRESHOLD) return null;
  return makeAnomaly(workspaceId, "publish_volume_spike", "high",
    `Publish volume ${recent} posts/hr vs avg ${avg.toFixed(1)}/hr (${Math.round(recent / avg)}× baseline)`);
}

async function detectOffHoursActivity(workspaceId: string): Promise<AnomalyEvent | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  const rows = await sql`
    SELECT COUNT(*) as cnt
    FROM scheduled_posts
    WHERE workspace_id = ${workspaceId}
      AND published_at IS NOT NULL
      AND (
        EXTRACT(HOUR FROM published_at AT TIME ZONE 'UTC') >= ${OFF_HOURS_START}
        OR EXTRACT(HOUR FROM published_at AT TIME ZONE 'UTC') < ${OFF_HOURS_END}
      )
      AND published_at > now() - interval '24 hours'
  `;
  const cnt = Number(rows[0]?.cnt ?? 0);
  if (cnt < 3) return null;
  return makeAnomaly(workspaceId, "off_hours_activity", "medium",
    `${cnt} posts published during off-hours (10pm–6am UTC) in last 24h`);
}

async function detectRapidFailSequence(workspaceId: string): Promise<AnomalyEvent | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  const since = new Date(Date.now() - RAPID_FAIL_WINDOW_MS).toISOString();
  const rows = await sql`
    SELECT COUNT(*) as cnt
    FROM scheduled_posts
    WHERE workspace_id = ${workspaceId}
      AND status = 'failed'
      AND updated_at >= ${since}
  `;
  const cnt = Number(rows[0]?.cnt ?? 0);
  if (cnt < RAPID_FAIL_MIN) return null;
  return makeAnomaly(workspaceId, "rapid_fail_sequence", "high",
    `${cnt} publish failures in the last 5 minutes`);
}

function makeAnomaly(
  workspaceId: string,
  type: AnomalyType,
  severity: AnomalyEvent["severity"],
  description: string,
): AnomalyEvent {
  return {
    id: randomUUID(),
    workspaceId,
    type,
    severity,
    description,
    metadata: {},
    acknowledgedAt: null,
    createdAt: new Date().toISOString(),
  };
}

export async function detectAnomalies(workspaceId: string): Promise<AnomalyEvent[]> {
  const [spike, offHours, fails] = await Promise.all([
    detectPublishVolumeSpike(workspaceId).catch(() => null),
    detectOffHoursActivity(workspaceId).catch(() => null),
    detectRapidFailSequence(workspaceId).catch(() => null),
  ]);
  return [spike, offHours, fails].filter((x): x is AnomalyEvent => x !== null);
}
