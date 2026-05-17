import { randomUUID } from "node:crypto";
import { getPostgresClient } from "./postgres.js";
import type { ContentScanResult, ScanFinding, ContentScanType, ScanSeverity } from "@home-link/marketer-pro-contract";

interface ScanRow {
  id: string; workspace_id: string; entity_type: string | null; entity_id: string | null;
  scanned_text: string; content_types: string[]; findings_json: unknown;
  overall_severity: string; passed: boolean; remediated_text: string | null; scanned_at: Date;
}

function rowToResult(r: ScanRow): ContentScanResult {
  return {
    id: r.id, workspaceId: r.workspace_id,
    entityType: r.entity_type, entityId: r.entity_id,
    scannedText: r.scanned_text,
    contentTypes: r.content_types as ContentScanType[],
    findings: (r.findings_json as ScanFinding[]) ?? [],
    overallSeverity: r.overall_severity as ScanSeverity,
    passed: r.passed,
    remediatedText: r.remediated_text,
    scannedAt: r.scanned_at.toISOString(),
  };
}

export async function insertScanResult(result: Omit<ContentScanResult, "id" | "scannedAt">): Promise<ContentScanResult | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  const id = randomUUID();
  const now = new Date().toISOString();
  try {
    const rows = await sql<ScanRow[]>`
      INSERT INTO content_safety_scans
        (id, workspace_id, entity_type, entity_id, scanned_text, content_types, findings_json, overall_severity, passed, remediated_text, scanned_at)
      VALUES (
        ${id}, ${result.workspaceId}, ${result.entityType ?? null}, ${result.entityId ?? null},
        ${result.scannedText.slice(0, 10000)}, ${result.contentTypes},
        ${sql.json(result.findings as unknown as Parameters<typeof sql.json>[0])},
        ${result.overallSeverity}, ${result.passed}, ${result.remediatedText ?? null}, ${now}
      ) RETURNING *
    `;
    return rows[0] ? rowToResult(rows[0]) : null;
  } catch { return null; }
}

export async function listScanResults(workspaceId: string, opts: {
  entityType?: string; entityId?: string; limit?: number;
} = {}): Promise<ContentScanResult[]> {
  const sql = getPostgresClient();
  if (!sql) return [];
  const limit = opts.limit ?? 20;
  try {
    if (opts.entityType && opts.entityId) {
      return (await sql<ScanRow[]>`
        SELECT * FROM content_safety_scans
        WHERE workspace_id = ${workspaceId}
          AND entity_type = ${opts.entityType} AND entity_id = ${opts.entityId}
        ORDER BY scanned_at DESC LIMIT ${limit}
      `).map(rowToResult);
    }
    return (await sql<ScanRow[]>`
      SELECT * FROM content_safety_scans
      WHERE workspace_id = ${workspaceId}
      ORDER BY scanned_at DESC LIMIT ${limit}
    `).map(rowToResult);
  } catch { return []; }
}

export async function getScanResult(id: string): Promise<ContentScanResult | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<ScanRow[]>`SELECT * FROM content_safety_scans WHERE id = ${id}`;
    return rows[0] ? rowToResult(rows[0]) : null;
  } catch { return null; }
}

export async function updateRemediatedText(id: string, remediatedText: string): Promise<ContentScanResult | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<ScanRow[]>`
      UPDATE content_safety_scans SET remediated_text = ${remediatedText} WHERE id = ${id} RETURNING *
    `;
    return rows[0] ? rowToResult(rows[0]) : null;
  } catch { return null; }
}
