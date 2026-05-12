/**
 * Postgres persistence for {@link generation_drafts} — Phase 2 draft + audit trail.
 */

import {
  DecisionAuditEntrySchema,
  DecisionRecordSchema,
  type DecisionAuditLog,
  type DecisionRecord,
  type GenerationBrief,
} from "@home-link/marketer-pro-contract";
import { z } from "zod";
import { getPostgresClient } from "./postgres.js";

/** Round-trip through JSON so values satisfy `postgres` `sql.json` typing. */
function toSqlJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

const AuditLogSchema = z.array(DecisionAuditEntrySchema);

export type GenerationDraftStatus =
  | "pending_approval"
  | "approved"
  | "rejected";

export interface GenerationDraftRow {
  readonly tenant_id: string;
  readonly id: string;
  readonly brief_id: string;
  readonly brief_json: unknown;
  readonly draft_body: string;
  readonly status: GenerationDraftStatus;
  readonly decision_record_json: DecisionRecord | null;
  readonly audit_log_json: DecisionAuditLog;
  readonly created_at: string;
  readonly updated_at: string;
}

export type GenerationDraftResolve =
  | { readonly mode: "no_database" }
  | { readonly mode: "not_found" }
  | { readonly mode: "error"; readonly message: string }
  | { readonly mode: "ok"; readonly row: GenerationDraftRow };

function parseRow(raw: {
  tenant_id: string;
  id: string;
  brief_id: string;
  brief_json: unknown;
  draft_body: string;
  status: string;
  decision_record_json: unknown;
  audit_log_json: unknown;
  created_at: Date;
  updated_at: Date;
}): GenerationDraftRow {
  const audit = AuditLogSchema.parse(raw.audit_log_json);
  const decision =
    raw.decision_record_json === null || raw.decision_record_json === undefined
      ? null
      : DecisionRecordSchema.parse(raw.decision_record_json);
  return {
    tenant_id: raw.tenant_id,
    id: raw.id,
    brief_id: raw.brief_id,
    brief_json: raw.brief_json,
    draft_body: raw.draft_body,
    status: raw.status as GenerationDraftStatus,
    decision_record_json: decision,
    audit_log_json: audit,
    created_at: raw.created_at.toISOString(),
    updated_at: raw.updated_at.toISOString(),
  };
}

export async function insertGenerationDraft(row: {
  readonly tenantId: string;
  readonly id: string;
  readonly briefId: string;
  readonly brief: GenerationBrief;
  readonly draftBody: string;
  readonly auditLog: DecisionAuditLog;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const sql = getPostgresClient();
  if (!sql) {
    return { ok: false, message: "no_database" };
  }
  try {
    await sql`
      INSERT INTO generation_drafts (
        tenant_id, id, brief_id, brief_json, draft_body, status, audit_log_json
      )
      VALUES (
        ${row.tenantId},
        ${row.id},
        ${row.briefId},
        ${sql.json(toSqlJson(row.brief))},
        ${row.draftBody},
        'pending_approval',
        ${sql.json(toSqlJson([...row.auditLog]))}
      )
    `;
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, message };
  }
}

/** List row without `brief_json` / `draft_body` / audit payloads — for brief history UIs. */
export type GenerationDraftSummaryRow = {
  readonly tenant_id: string;
  readonly id: string;
  readonly brief_id: string;
  readonly status: GenerationDraftStatus;
  readonly created_at: string;
  readonly updated_at: string;
};

export type ListGenerationDraftSummariesResolve =
  | { readonly mode: "no_database" }
  | { readonly mode: "error"; readonly message: string }
  | {
      readonly mode: "ok";
      readonly rows: readonly GenerationDraftSummaryRow[];
    };

export async function listGenerationDraftSummariesByBrief(
  tenantId: string,
  briefId: string,
  limit: number,
): Promise<ListGenerationDraftSummariesResolve> {
  const sql = getPostgresClient();
  if (!sql) {
    return { mode: "no_database" };
  }
  const lim = Math.min(Math.max(1, Math.floor(limit)), 100);
  try {
    const rows = await sql<
      {
        tenant_id: string;
        id: string;
        brief_id: string;
        status: string;
        created_at: Date;
        updated_at: Date;
      }[]
    >`
      SELECT tenant_id, id, brief_id, status, created_at, updated_at
      FROM generation_drafts
      WHERE tenant_id = ${tenantId} AND brief_id = ${briefId}
      ORDER BY created_at DESC
      LIMIT ${lim}
    `;
    return {
      mode: "ok",
      rows: rows.map((r) => ({
        tenant_id: r.tenant_id,
        id: r.id,
        brief_id: r.brief_id,
        status: r.status as GenerationDraftStatus,
        created_at: r.created_at.toISOString(),
        updated_at: r.updated_at.toISOString(),
      })),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { mode: "error", message };
  }
}

export async function resolveGenerationDraft(
  tenantId: string,
  draftId: string,
): Promise<GenerationDraftResolve> {
  const sql = getPostgresClient();
  if (!sql) {
    return { mode: "no_database" };
  }
  try {
    const rows = await sql<
      {
        tenant_id: string;
        id: string;
        brief_id: string;
        brief_json: unknown;
        draft_body: string;
        status: string;
        decision_record_json: unknown;
        audit_log_json: unknown;
        created_at: Date;
        updated_at: Date;
      }[]
    >`
      SELECT tenant_id, id, brief_id, brief_json, draft_body, status,
             decision_record_json, audit_log_json, created_at, updated_at
      FROM generation_drafts
      WHERE tenant_id = ${tenantId} AND id = ${draftId}
      LIMIT 1
    `;
    const raw = rows[0];
    if (!raw) {
      return { mode: "not_found" };
    }
    return { mode: "ok", row: parseRow(raw) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { mode: "error", message };
  }
}

export type UpdateGenerationDraftRowResult =
  | { ok: true }
  | { ok: false; code: "no_database" }
  | { ok: false; code: "not_pending" }
  | { ok: false; code: "error"; message: string };

export async function updateGenerationDraftRejected(args: {
  readonly tenantId: string;
  readonly draftId: string;
  readonly auditLog: DecisionAuditLog;
}): Promise<UpdateGenerationDraftRowResult> {
  const sql = getPostgresClient();
  if (!sql) {
    return { ok: false, code: "no_database" };
  }
  try {
    const rows = await sql<{ id: string }[]>`
      UPDATE generation_drafts
      SET status = 'rejected',
          decision_record_json = NULL,
          audit_log_json = ${sql.json(toSqlJson([...args.auditLog]))},
          updated_at = now()
      WHERE tenant_id = ${args.tenantId} AND id = ${args.draftId}
        AND status = 'pending_approval'
      RETURNING id
    `;
    if (!rows[0]) {
      return { ok: false, code: "not_pending" };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "error", message };
  }
}

export async function updateGenerationDraftApproved(args: {
  readonly tenantId: string;
  readonly draftId: string;
  readonly decisionRecord: DecisionRecord;
  readonly auditLog: DecisionAuditLog;
}): Promise<UpdateGenerationDraftRowResult> {
  const sql = getPostgresClient();
  if (!sql) {
    return { ok: false, code: "no_database" };
  }
  try {
    const rows = await sql<{ id: string }[]>`
      UPDATE generation_drafts
      SET status = 'approved',
          decision_record_json = ${sql.json(toSqlJson(args.decisionRecord))},
          audit_log_json = ${sql.json(toSqlJson([...args.auditLog]))},
          updated_at = now()
      WHERE tenant_id = ${args.tenantId} AND id = ${args.draftId}
        AND status = 'pending_approval'
      RETURNING id
    `;
    if (!rows[0]) {
      return { ok: false, code: "not_pending" };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "error", message };
  }
}
