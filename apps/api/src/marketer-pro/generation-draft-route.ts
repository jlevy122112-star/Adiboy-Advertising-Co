/**
 * HTTP-facing generation draft routes — validate JSON bodies or query params and
 * delegate to draft flows / Postgres reads.
 */

import { z } from "zod";

import {
  executeApproveGenerationDraft,
  executeCreateGenerationDraft,
  executeRejectGenerationDraft,
} from "./draft-from-brief.js";
import {
  listGenerationDraftSummariesByBrief,
  resolveGenerationDraft,
} from "../db/generation-draft.js";

export const CreateGenerationDraftBodySchema = z
  .object({
    tenantId: z.string().min(1).max(120),
    brief: z.unknown(),
  })
  .strict();

export type CreateGenerationDraftBody = z.infer<
  typeof CreateGenerationDraftBodySchema
>;

export const ApproveGenerationDraftBodySchema = z
  .object({
    tenantId: z.string().min(1).max(120),
    draftId: z.string().min(1).max(120),
    actorUserId: z.string().min(1).max(120),
    approvedBody: z.string().min(1).max(50_000),
  })
  .strict();

export type ApproveGenerationDraftBody = z.infer<
  typeof ApproveGenerationDraftBodySchema
>;

export const RejectGenerationDraftBodySchema = z
  .object({
    tenantId: z.string().min(1).max(120),
    draftId: z.string().min(1).max(120),
    actorUserId: z.string().min(1).max(120),
    rejectionNote: z.string().max(2000).optional(),
  })
  .strict();

export type RejectGenerationDraftBody = z.infer<
  typeof RejectGenerationDraftBodySchema
>;

export type GenerationDraftHttpSuccess<T> = {
  readonly ok: true;
  readonly status: number;
  readonly body: T;
};

export type GenerationDraftHttpError = {
  readonly ok: false;
  readonly status: number;
  readonly body: unknown;
};

export type GenerationDraftHttpOutcome =
  | GenerationDraftHttpSuccess<unknown>
  | GenerationDraftHttpError;

export async function executeCreateGenerationDraftRequest(
  body: unknown,
): Promise<GenerationDraftHttpOutcome> {
  const parsed = CreateGenerationDraftBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "validation_error",
        message: parsed.error.message,
      },
    };
  }
  const outcome = await executeCreateGenerationDraft(
    parsed.data.tenantId,
    parsed.data.brief,
  );
  if (!outcome.ok) {
    if (outcome.code === "brief_parse") {
      return {
        ok: false,
        status: 400,
        body: { error: "brief_parse", message: outcome.message },
      };
    }
    if (outcome.code === "tenant_workspace_mismatch") {
      return {
        ok: false,
        status: 400,
        body: { error: "tenant_workspace_mismatch", message: outcome.message },
      };
    }
    if (outcome.code === "brief_not_ready") {
      return {
        ok: false,
        status: 422,
        body: { error: "brief_not_ready", issues: outcome.issues },
      };
    }
    if (outcome.code === "database") {
      return {
        ok: false,
        status: 503,
        body: { error: "database_required", message: outcome.message },
      };
    }
    return {
      ok: false,
      status: 500,
      body: { error: "database_insert", message: outcome.message },
    };
  }
  return {
    ok: true,
    status: 201,
    body: {
      draftId: outcome.draftId,
      draftBody: outcome.draftBody,
      briefId: outcome.briefId,
    },
  };
}

export async function executeApproveGenerationDraftRequest(
  body: unknown,
): Promise<GenerationDraftHttpOutcome> {
  const parsed = ApproveGenerationDraftBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "validation_error",
        message: parsed.error.message,
      },
    };
  }
  const outcome = await executeApproveGenerationDraft(parsed.data);
  if (!outcome.ok) {
    if (outcome.code === "database") {
      return {
        ok: false,
        status: 503,
        body: { error: "database_required", message: outcome.message },
      };
    }
    if (outcome.code === "not_found") {
      return {
        ok: false,
        status: 404,
        body: { error: "not_found" },
      };
    }
    if (outcome.code === "database_read") {
      return {
        ok: false,
        status: 500,
        body: { error: "database_read", message: outcome.message },
      };
    }
    if (outcome.code === "wrong_status") {
      return {
        ok: false,
        status: 409,
        body: { error: "wrong_status", status: outcome.status },
      };
    }
    if (outcome.code === "tenant_workspace_mismatch") {
      return {
        ok: false,
        status: 400,
        body: {
          error: "tenant_workspace_mismatch",
          message: outcome.message,
        },
      };
    }
    if (outcome.code === "brief_parse") {
      return {
        ok: false,
        status: 500,
        body: { error: "brief_parse", message: outcome.message },
      };
    }
    if (outcome.code === "commit_decision") {
      return {
        ok: false,
        status: 400,
        body: { error: "commit_decision", reason: outcome.reason },
      };
    }
    if (outcome.code === "audit_validation") {
      return {
        ok: false,
        status: 400,
        body: { error: "audit_validation", reason: outcome.reason },
      };
    }
    if (outcome.code === "append_audit") {
      return {
        ok: false,
        status: 500,
        body: { error: "append_audit", reason: outcome.reason },
      };
    }
    return {
      ok: false,
      status: 500,
      body: { error: "database_update", message: outcome.message },
    };
  }
  return {
    ok: true,
    status: 200,
    body: { decisionRecordId: outcome.decisionRecordId },
  };
}

export async function executeRejectGenerationDraftRequest(
  body: unknown,
): Promise<GenerationDraftHttpOutcome> {
  const parsed = RejectGenerationDraftBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "validation_error",
        message: parsed.error.message,
      },
    };
  }
  const outcome = await executeRejectGenerationDraft(parsed.data);
  if (!outcome.ok) {
    if (outcome.code === "database") {
      return {
        ok: false,
        status: 503,
        body: { error: "database_required", message: outcome.message },
      };
    }
    if (outcome.code === "not_found") {
      return {
        ok: false,
        status: 404,
        body: { error: "not_found" },
      };
    }
    if (outcome.code === "database_read") {
      return {
        ok: false,
        status: 500,
        body: { error: "database_read", message: outcome.message },
      };
    }
    if (outcome.code === "wrong_status") {
      return {
        ok: false,
        status: 409,
        body: { error: "wrong_status", status: outcome.status },
      };
    }
    if (outcome.code === "tenant_workspace_mismatch") {
      return {
        ok: false,
        status: 400,
        body: {
          error: "tenant_workspace_mismatch",
          message: outcome.message,
        },
      };
    }
    if (outcome.code === "brief_parse") {
      return {
        ok: false,
        status: 500,
        body: { error: "brief_parse", message: outcome.message },
      };
    }
    if (outcome.code === "audit_validation") {
      return {
        ok: false,
        status: 400,
        body: { error: "audit_validation", reason: outcome.reason },
      };
    }
    if (outcome.code === "append_audit") {
      return {
        ok: false,
        status: 500,
        body: { error: "append_audit", reason: outcome.reason },
      };
    }
    return {
      ok: false,
      status: 500,
      body: { error: "database_update", message: outcome.message },
    };
  }
  return {
    ok: true,
    status: 200,
    body: { rejected: true },
  };
}

export const GetGenerationDraftQuerySchema = z
  .object({
    tenantId: z.string().min(1).max(120),
    draftId: z.string().min(1).max(120),
  })
  .strict();

export const ListGenerationDraftsQuerySchema = z
  .object({
    tenantId: z.string().min(1).max(120),
    briefId: z.string().min(1).max(120),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  })
  .strict();

/** GET — single draft row (full brief + audit payloads). */
export async function executeGetGenerationDraftRequestFromSearchParams(
  searchParams: URLSearchParams,
): Promise<GenerationDraftHttpOutcome> {
  const parsed = GetGenerationDraftQuerySchema.safeParse(
    Object.fromEntries(searchParams.entries()),
  );
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "validation_error",
        message: parsed.error.message,
      },
    };
  }
  const { tenantId, draftId } = parsed.data;
  const resolved = await resolveGenerationDraft(tenantId, draftId);
  if (resolved.mode === "no_database") {
    return {
      ok: false,
      status: 503,
      body: {
        error: "database_required",
        message: "DATABASE_URL is not set; cannot load generation drafts.",
      },
    };
  }
  if (resolved.mode === "not_found") {
    return { ok: false, status: 404, body: { error: "not_found" } };
  }
  if (resolved.mode === "error") {
    return {
      ok: false,
      status: 500,
      body: { error: "database_read", message: resolved.message },
    };
  }
  const row = resolved.row;
  return {
    ok: true,
    status: 200,
    body: {
      tenantId: row.tenant_id,
      draftId: row.id,
      briefId: row.brief_id,
      status: row.status,
      draftBody: row.draft_body,
      brief: row.brief_json,
      auditLog: row.audit_log_json,
      decisionRecord: row.decision_record_json,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  };
}

/** GET — lightweight history for one brief (no `brief_json` / bodies). */
export async function executeListGenerationDraftsRequestFromSearchParams(
  searchParams: URLSearchParams,
): Promise<GenerationDraftHttpOutcome> {
  const parsed = ListGenerationDraftsQuerySchema.safeParse(
    Object.fromEntries(searchParams.entries()),
  );
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "validation_error",
        message: parsed.error.message,
      },
    };
  }
  const { tenantId, briefId, limit } = parsed.data;
  const listed = await listGenerationDraftSummariesByBrief(
    tenantId,
    briefId,
    limit,
  );
  if (listed.mode === "no_database") {
    return {
      ok: false,
      status: 503,
      body: {
        error: "database_required",
        message: "DATABASE_URL is not set; cannot load generation drafts.",
      },
    };
  }
  if (listed.mode === "error") {
    return {
      ok: false,
      status: 500,
      body: { error: "database_list", message: listed.message },
    };
  }
  return {
    ok: true,
    status: 200,
    body: {
      drafts: listed.rows.map((r) => ({
        draftId: r.id,
        briefId: r.brief_id,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    },
  };
}
