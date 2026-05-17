import { randomUUID } from "node:crypto";
import { getPostgresClient } from "./postgres.js";
import type { ScheduleRecommendation, BestTimeSlot } from "@home-link/marketer-pro-contract";

interface RecRow {
  id: string; tenant_id: string; schedule_entry_id: string | null;
  network: string; content_type: string | null; audience_timezone: string | null;
  top_slots_json: unknown; applied_slot_json: unknown | null;
  applied_at: Date | null; created_at: Date;
}

function rowToRec(r: RecRow): ScheduleRecommendation {
  return {
    id: r.id, tenantId: r.tenant_id,
    scheduleEntryId: r.schedule_entry_id,
    network: r.network, contentType: r.content_type,
    audienceTimezone: r.audience_timezone,
    topSlots: r.top_slots_json as BestTimeSlot[],
    appliedSlot: r.applied_slot_json as BestTimeSlot | null,
    appliedAt: r.applied_at?.toISOString() ?? null,
    createdAt: r.created_at.toISOString(),
  };
}

export async function insertScheduleRecommendation(input: {
  tenantId: string;
  scheduleEntryId?: string;
  network: string;
  contentType?: string;
  audienceTimezone?: string;
  topSlots: BestTimeSlot[];
}): Promise<ScheduleRecommendation | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<RecRow[]>`
      INSERT INTO schedule_recommendations
        (id, tenant_id, schedule_entry_id, network, content_type, audience_timezone, top_slots_json)
      VALUES (
        ${randomUUID()}, ${input.tenantId}, ${input.scheduleEntryId ?? null},
        ${input.network}, ${input.contentType ?? null}, ${input.audienceTimezone ?? null},
        ${sql.json(input.topSlots as unknown as Parameters<typeof sql.json>[0])}
      ) RETURNING *
    `;
    return rows[0] ? rowToRec(rows[0]) : null;
  } catch { return null; }
}

export async function applyScheduleRecommendation(
  id: string,
  slot: BestTimeSlot,
): Promise<ScheduleRecommendation | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<RecRow[]>`
      UPDATE schedule_recommendations
      SET applied_slot_json = ${sql.json(slot as unknown as Parameters<typeof sql.json>[0])},
          applied_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return rows[0] ? rowToRec(rows[0]) : null;
  } catch { return null; }
}

export async function getLatestRecommendation(
  tenantId: string,
  scheduleEntryId: string,
): Promise<ScheduleRecommendation | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<RecRow[]>`
      SELECT * FROM schedule_recommendations
      WHERE tenant_id = ${tenantId} AND schedule_entry_id = ${scheduleEntryId}
      ORDER BY created_at DESC LIMIT 1
    `;
    return rows[0] ? rowToRec(rows[0]) : null;
  } catch { return null; }
}

export async function listRecommendations(
  tenantId: string,
  network?: string,
  limit = 20,
): Promise<ScheduleRecommendation[]> {
  const sql = getPostgresClient();
  if (!sql) return [];
  try {
    if (network) {
      return (await sql<RecRow[]>`
        SELECT * FROM schedule_recommendations
        WHERE tenant_id=${tenantId} AND network=${network}
        ORDER BY created_at DESC LIMIT ${limit}
      `).map(rowToRec);
    }
    return (await sql<RecRow[]>`
      SELECT * FROM schedule_recommendations
      WHERE tenant_id=${tenantId}
      ORDER BY created_at DESC LIMIT ${limit}
    `).map(rowToRec);
  } catch { return []; }
}
