/**
 * Phase 2 — brief → stub text draft, Postgres row, and append-only audit trail
 * using `@home-link/marketer-pro-contract` helpers.
 */

import { randomUUID } from "node:crypto";

import {
  appendAuditEntry,
  commitDecision,
  createAuditEntry,
  GenerationBriefSchema,
  validateAuditEntryAgainstPoint,
  validateBriefForGeneration,
  type DecisionAuditLog,
  type GenerationBrief,
} from "@home-link/marketer-pro-contract";

import {
  insertGenerationDraft,
  resolveGenerationDraft,
  updateGenerationDraftApproved,
  updateGenerationDraftRejected,
} from "../db/generation-draft.js";
import { COPY_BODY_APPROVAL_POINT } from "./copy-draft-decision-point.js";
import { generateDraftBodyFromBrief } from "./generate-draft-body.js";

export { generateDraftBodyFromBrief as buildStubDraftBody } from "./generate-draft-body.js";

/** Exposed for unit tests — production path uses {@link executeCreateGenerationDraft}. */
export function buildInitialOfferAuditLog(
  brief: GenerationBrief,
  createdAt: string,
): DecisionAuditLog {
  const entry = createAuditEntry({
    entryId: `audit_${randomUUID()}`,
    workspaceId: brief.workspaceId,
    kind: "ai_suggestion_offered",
    target: { kind: "brief", id: brief.briefId, path: "copy.body" },
    decisionPointId: COPY_BODY_APPROVAL_POINT.id,
    record: null,
    alternativesOffered: [
      { optionId: "stub_primary", source: "ai", confidence: 0.72 },
    ],
    briefId: brief.briefId,
    createdAt,
    rationale: "Deterministic stub generator proposed copy.body.",
  });
  const appended = appendAuditEntry([], entry);
  if (!appended.ok) {
    throw new Error(`appendAuditEntry failed: ${appended.reason}`);
  }
  return appended.log;
}

export type CreateDraftFailure =
  | { readonly code: "brief_parse"; readonly message: string }
  | {
      readonly code: "tenant_workspace_mismatch";
      readonly message: string;
    }
  | { readonly code: "brief_not_ready"; readonly issues: readonly unknown[] }
  | { readonly code: "database"; readonly message: string }
  | { readonly code: "database_insert"; readonly message: string };

export type CreateDraftSuccess = {
  readonly ok: true;
  readonly draftId: string;
  readonly draftBody: string;
  readonly briefId: string;
};

export type CreateDraftOutcome = CreateDraftSuccess | { ok: false } & CreateDraftFailure;

export async function executeCreateGenerationDraft(
  tenantId: string,
  body: unknown,
): Promise<CreateDraftOutcome> {
  const parsed = GenerationBriefSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      code: "brief_parse",
      message: parsed.error.message,
    };
  }
  const brief = parsed.data;
  if (brief.workspaceId !== tenantId) {
    return {
      ok: false,
      code: "tenant_workspace_mismatch",
      message:
        "brief.workspaceId must equal tenantId for this API (tenant-scoped isolation).",
    };
  }
  const ready = validateBriefForGeneration(brief);
  if (!ready.ok) {
    return {
      ok: false,
      code: "brief_not_ready",
      issues: ready.issues,
    };
  }
  const draftBody = generateDraftBodyFromBrief(brief);
  const createdAt = new Date().toISOString();
  const auditLog = buildInitialOfferAuditLog(brief, createdAt);
  const draftId = `draft_${randomUUID()}`;
  const inserted = await insertGenerationDraft({
    tenantId,
    id: draftId,
    briefId: brief.briefId,
    brief,
    draftBody,
    auditLog,
  });
  if (inserted.ok === false && inserted.message === "no_database") {
    return {
      ok: false,
      code: "database",
      message: "DATABASE_URL is not set; cannot persist generation drafts.",
    };
  }
  if (!inserted.ok) {
    return {
      ok: false,
      code: "database_insert",
      message: inserted.message,
    };
  }
  return {
    ok: true,
    draftId,
    draftBody,
    briefId: brief.briefId,
  };
}

export type ApproveDraftFailure =
  | { readonly code: "database"; readonly message: string }
  | { readonly code: "not_found" }
  | { readonly code: "database_read"; readonly message: string }
  | { readonly code: "wrong_status"; readonly status: string }
  | {
      readonly code: "tenant_workspace_mismatch";
      readonly message: string;
    }
  | { readonly code: "brief_parse"; readonly message: string }
  | { readonly code: "commit_decision"; readonly reason: string }
  | { readonly code: "audit_validation"; readonly reason: string }
  | { readonly code: "append_audit"; readonly reason: string }
  | { readonly code: "database_update"; readonly message: string };

export type ApproveDraftSuccess = {
  readonly ok: true;
  readonly decisionRecordId: string;
};

export type ApproveDraftOutcome =
  | ApproveDraftSuccess
  | ({ ok: false } & ApproveDraftFailure);

export async function executeApproveGenerationDraft(args: {
  readonly tenantId: string;
  readonly draftId: string;
  readonly actorUserId: string;
  readonly approvedBody: string;
}): Promise<ApproveDraftOutcome> {
  const resolved = await resolveGenerationDraft(args.tenantId, args.draftId);
  if (resolved.mode === "no_database") {
    return {
      ok: false,
      code: "database",
      message: "DATABASE_URL is not set; cannot load generation drafts.",
    };
  }
  if (resolved.mode === "not_found") {
    return { ok: false, code: "not_found" };
  }
  if (resolved.mode === "error") {
    return {
      ok: false,
      code: "database_read",
      message: resolved.message,
    };
  }
  const row = resolved.row;
  if (row.status !== "pending_approval") {
    return { ok: false, code: "wrong_status", status: row.status };
  }
  const briefParsed = GenerationBriefSchema.safeParse(row.brief_json);
  if (!briefParsed.success) {
    return {
      ok: false,
      code: "brief_parse",
      message: briefParsed.error.message,
    };
  }
  const brief = briefParsed.data;
  if (brief.workspaceId !== args.tenantId) {
    return {
      ok: false,
      code: "tenant_workspace_mismatch",
      message:
        "brief.workspaceId must equal tenantId for this API (tenant-scoped isolation).",
    };
  }
  const recordId = `rec_${randomUUID()}`;
  const committedAt = new Date().toISOString();
  const committed = commitDecision({
    point: COPY_BODY_APPROVAL_POINT,
    recordId,
    workspaceId: brief.workspaceId,
    actorUserId: args.actorUserId,
    chosenOptionId: null,
    customValue: args.approvedBody,
    source: "user",
    committedAt,
    note: "User approved copy.body for generation draft.",
  });
  if (!committed.ok) {
    return {
      ok: false,
      code: "commit_decision",
      reason: committed.reason,
    };
  }
  const auditEntry = createAuditEntry({
    entryId: `audit_${randomUUID()}`,
    workspaceId: brief.workspaceId,
    kind: "decision_committed",
    target: { kind: "brief", id: brief.briefId, path: "copy.body" },
    decisionPointId: COPY_BODY_APPROVAL_POINT.id,
    record: committed.record,
    briefId: brief.briefId,
    createdAt: committedAt,
    rationale: "",
  });
  const v = validateAuditEntryAgainstPoint(COPY_BODY_APPROVAL_POINT, auditEntry);
  if (!v.ok) {
    return {
      ok: false,
      code: "audit_validation",
      reason: v.reason,
    };
  }
  const appended = appendAuditEntry(row.audit_log_json, auditEntry);
  if (!appended.ok) {
    return {
      ok: false,
      code: "append_audit",
      reason: appended.reason,
    };
  }
  const updated = await updateGenerationDraftApproved({
    tenantId: args.tenantId,
    draftId: args.draftId,
    decisionRecord: committed.record,
    auditLog: appended.log,
  });
  if (!updated.ok) {
    if (updated.code === "no_database") {
      return {
        ok: false,
        code: "database",
        message: "DATABASE_URL is not set; cannot load generation drafts.",
      };
    }
    if (updated.code === "not_pending") {
      const again = await resolveGenerationDraft(args.tenantId, args.draftId);
      if (again.mode === "ok") {
        return { ok: false, code: "wrong_status", status: again.row.status };
      }
      if (again.mode === "not_found") {
        return { ok: false, code: "not_found" };
      }
      if (again.mode === "no_database") {
        return {
          ok: false,
          code: "database",
          message: "DATABASE_URL is not set; cannot load generation drafts.",
        };
      }
      return {
        ok: false,
        code: "database_read",
        message: again.message,
      };
    }
    return {
      ok: false,
      code: "database_update",
      message: updated.message,
    };
  }
  return { ok: true, decisionRecordId: recordId };
}

export type RejectDraftFailure =
  | { readonly code: "database"; readonly message: string }
  | { readonly code: "not_found" }
  | { readonly code: "database_read"; readonly message: string }
  | { readonly code: "wrong_status"; readonly status: string }
  | {
      readonly code: "tenant_workspace_mismatch";
      readonly message: string;
    }
  | { readonly code: "brief_parse"; readonly message: string }
  | { readonly code: "audit_validation"; readonly reason: string }
  | { readonly code: "append_audit"; readonly reason: string }
  | { readonly code: "database_update"; readonly message: string };

export type RejectDraftSuccess = { readonly ok: true };

export type RejectDraftOutcome = RejectDraftSuccess | ({ ok: false } & RejectDraftFailure);

/**
 * Human rejects the stub (or future model) draft — append `ai_suggestion_rejected`
 * and mark row `rejected` (no `DecisionRecord`; user did not commit a body).
 */
export async function executeRejectGenerationDraft(args: {
  readonly tenantId: string;
  readonly draftId: string;
  readonly actorUserId: string;
  readonly rejectionNote?: string;
}): Promise<RejectDraftOutcome> {
  const resolved = await resolveGenerationDraft(args.tenantId, args.draftId);
  if (resolved.mode === "no_database") {
    return {
      ok: false,
      code: "database",
      message: "DATABASE_URL is not set; cannot load generation drafts.",
    };
  }
  if (resolved.mode === "not_found") {
    return { ok: false, code: "not_found" };
  }
  if (resolved.mode === "error") {
    return {
      ok: false,
      code: "database_read",
      message: resolved.message,
    };
  }
  const row = resolved.row;
  if (row.status !== "pending_approval") {
    return { ok: false, code: "wrong_status", status: row.status };
  }
  const briefParsed = GenerationBriefSchema.safeParse(row.brief_json);
  if (!briefParsed.success) {
    return {
      ok: false,
      code: "brief_parse",
      message: briefParsed.error.message,
    };
  }
  const brief = briefParsed.data;
  if (brief.workspaceId !== args.tenantId) {
    return {
      ok: false,
      code: "tenant_workspace_mismatch",
      message:
        "brief.workspaceId must equal tenantId for this API (tenant-scoped isolation).",
    };
  }
  const rejectedAt = new Date().toISOString();
  const note = args.rejectionNote?.trim();
  const rationale = note ?? `Rejected by user ${args.actorUserId}.`;
  const auditEntry = createAuditEntry({
    entryId: `audit_${randomUUID()}`,
    workspaceId: brief.workspaceId,
    kind: "ai_suggestion_rejected",
    target: { kind: "brief", id: brief.briefId, path: "copy.body" },
    decisionPointId: COPY_BODY_APPROVAL_POINT.id,
    record: null,
    alternativesOffered: [
      { optionId: "stub_primary", source: "ai", confidence: 0.72 },
    ],
    briefId: brief.briefId,
    createdAt: rejectedAt,
    rationale,
  });
  const v = validateAuditEntryAgainstPoint(COPY_BODY_APPROVAL_POINT, auditEntry);
  if (!v.ok) {
    return {
      ok: false,
      code: "audit_validation",
      reason: v.reason,
    };
  }
  const appended = appendAuditEntry(row.audit_log_json, auditEntry);
  if (!appended.ok) {
    return {
      ok: false,
      code: "append_audit",
      reason: appended.reason,
    };
  }
  const updated = await updateGenerationDraftRejected({
    tenantId: args.tenantId,
    draftId: args.draftId,
    auditLog: appended.log,
  });
  if (!updated.ok) {
    if (updated.code === "no_database") {
      return {
        ok: false,
        code: "database",
        message: "DATABASE_URL is not set; cannot load generation drafts.",
      };
    }
    if (updated.code === "not_pending") {
      const again = await resolveGenerationDraft(args.tenantId, args.draftId);
      if (again.mode === "ok") {
        return { ok: false, code: "wrong_status", status: again.row.status };
      }
      if (again.mode === "not_found") {
        return { ok: false, code: "not_found" };
      }
      if (again.mode === "no_database") {
        return {
          ok: false,
          code: "database",
          message: "DATABASE_URL is not set; cannot load generation drafts.",
        };
      }
      return {
        ok: false,
        code: "database_read",
        message: again.message,
      };
    }
    return {
      ok: false,
      code: "database_update",
      message: updated.message,
    };
  }
  return { ok: true };
}
