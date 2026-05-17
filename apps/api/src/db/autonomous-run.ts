import { getPostgresClient } from "./postgres.js";
import type { AutonomousRun, AutonomousRunEvent } from "@home-link/marketer-pro-contract";

interface RunRow {
  id: string; tenant_id: string; workspace_id: string;
  state: string; networks: string[]; scope: string;
  run_json: unknown; created_at: Date; updated_at: Date;
}

function rowToRun(r: RunRow): AutonomousRun {
  return r.run_json as AutonomousRun;
}

export async function insertAutonomousRun(run: AutonomousRun): Promise<AutonomousRun | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<RunRow[]>`
      INSERT INTO autonomous_runs (id, tenant_id, workspace_id, state, networks, scope, run_json)
      VALUES (
        ${run.runId}, ${run.workspaceId}, ${run.workspaceId},
        ${run.state}, ${run.request.platforms}, ${run.request.scope},
        ${sql.json(run as unknown as Parameters<typeof sql.json>[0])}
      ) RETURNING *
    `;
    return rows[0] ? rowToRun(rows[0]) : null;
  } catch { return null; }
}

export async function updateAutonomousRun(run: AutonomousRun): Promise<AutonomousRun | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<RunRow[]>`
      UPDATE autonomous_runs
      SET state = ${run.state},
          run_json = ${sql.json(run as unknown as Parameters<typeof sql.json>[0])},
          updated_at = NOW()
      WHERE id = ${run.runId}
      RETURNING *
    `;
    return rows[0] ? rowToRun(rows[0]) : null;
  } catch { return null; }
}

export async function getAutonomousRun(id: string): Promise<AutonomousRun | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<RunRow[]>`SELECT * FROM autonomous_runs WHERE id = ${id}`;
    return rows[0] ? rowToRun(rows[0]) : null;
  } catch { return null; }
}

export async function listAutonomousRuns(
  tenantId: string,
  state?: string,
  limit = 20,
): Promise<AutonomousRun[]> {
  const sql = getPostgresClient();
  if (!sql) return [];
  try {
    if (state) {
      return (await sql<RunRow[]>`
        SELECT * FROM autonomous_runs
        WHERE tenant_id = ${tenantId} AND state = ${state}
        ORDER BY updated_at DESC LIMIT ${limit}
      `).map(rowToRun);
    }
    return (await sql<RunRow[]>`
      SELECT * FROM autonomous_runs
      WHERE tenant_id = ${tenantId}
      ORDER BY updated_at DESC LIMIT ${limit}
    `).map(rowToRun);
  } catch { return []; }
}

interface EventRow { id: string; run_id: string; tenant_id: string; event_json: unknown; created_at: Date; }

export async function appendRunEvent(
  runId: string,
  tenantId: string,
  event: AutonomousRunEvent,
): Promise<void> {
  const sql = getPostgresClient();
  if (!sql) return;
  try {
    await sql`
      INSERT INTO autonomous_run_events (id, run_id, tenant_id, event_json)
      VALUES (${event.eventId}, ${runId}, ${tenantId},
        ${sql.json(event as unknown as Parameters<typeof sql.json>[0])})
    `;
  } catch { /* best-effort */ }
}

export async function listRunEvents(runId: string): Promise<AutonomousRunEvent[]> {
  const sql = getPostgresClient();
  if (!sql) return [];
  try {
    const rows = await sql<EventRow[]>`
      SELECT * FROM autonomous_run_events WHERE run_id = ${runId} ORDER BY created_at ASC
    `;
    return rows.map(r => r.event_json as AutonomousRunEvent);
  } catch { return []; }
}
