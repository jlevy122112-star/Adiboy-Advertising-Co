import { randomUUID } from "node:crypto";
import { getPostgresClient } from "./postgres.js";
import type { AnomalyEvent, AnomalyType, ScanSeverity } from "@home-link/marketer-pro-contract";

interface AnomalyRow {
  id: string; workspace_id: string; type: string; severity: string;
  description: string; metadata_json: unknown;
  acknowledged_at: Date | null; created_at: Date;
}

function rowToAnomaly(r: AnomalyRow): AnomalyEvent {
  return {
    id: r.id, workspaceId: r.workspace_id,
    type: r.type as AnomalyType, severity: r.severity as ScanSeverity,
    description: r.description,
    metadata: (r.metadata_json as Record<string, unknown>) ?? {},
    acknowledgedAt: r.acknowledged_at ? r.acknowledged_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
  };
}

export async function insertAnomalyEvent(args: Omit<AnomalyEvent, "id" | "acknowledgedAt" | "createdAt">): Promise<AnomalyEvent | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  const id = randomUUID();
  try {
    const rows = await sql<AnomalyRow[]>`
      INSERT INTO anomaly_events (id, workspace_id, type, severity, description, metadata_json)
      VALUES (
        ${id}, ${args.workspaceId}, ${args.type}, ${args.severity},
        ${args.description}, ${sql.json(args.metadata as unknown as Parameters<typeof sql.json>[0])}
      ) RETURNING *
    `;
    return rows[0] ? rowToAnomaly(rows[0]) : null;
  } catch { return null; }
}

export async function listAnomalyEvents(workspaceId: string, limit = 30): Promise<AnomalyEvent[]> {
  const sql = getPostgresClient();
  if (!sql) return [];
  try {
    return (await sql<AnomalyRow[]>`
      SELECT * FROM anomaly_events WHERE workspace_id = ${workspaceId}
      ORDER BY created_at DESC LIMIT ${limit}
    `).map(rowToAnomaly);
  } catch { return []; }
}

export async function acknowledgeAnomaly(id: string): Promise<AnomalyEvent | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<AnomalyRow[]>`
      UPDATE anomaly_events SET acknowledged_at = NOW() WHERE id = ${id} RETURNING *
    `;
    return rows[0] ? rowToAnomaly(rows[0]) : null;
  } catch { return null; }
}

export async function countUnacknowledged(workspaceId: string): Promise<number> {
  const sql = getPostgresClient();
  if (!sql) return 0;
  try {
    const rows = await sql<{ cnt: string }[]>`
      SELECT COUNT(*) AS cnt FROM anomaly_events
      WHERE workspace_id = ${workspaceId} AND acknowledged_at IS NULL
    `;
    return Number(rows[0]?.cnt ?? 0);
  } catch { return 0; }
}
