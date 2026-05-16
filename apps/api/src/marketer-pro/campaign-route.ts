/**
 * HTTP-facing campaign routes (Phase 4) — validate bodies / query params and
 * delegate to campaign + schedule persistence (attach schedule row to campaign).
 */

import { z } from "zod";

import {
  AttachScheduleEntryCampaignBodySchema,
  CreateCampaignBodySchema,
  CreateScheduleEntryBodySchema,
  DeleteScheduleEntryBodySchema,
  ListScheduleEntriesByTenantQuerySchema,
  ListScheduleEntriesForCampaignQuerySchema,
  scheduleEntryRecordFromSqlRow,
  UpdateScheduleEntryBodySchema,
} from "@home-link/marketer-pro-contract";

import {
  insertCampaign,
  listCampaignsByTenant,
  resolveCampaign,
} from "../db/campaign.js";
import {
  deleteScheduleEntry,
  insertScheduleEntry,
  listScheduleEntriesByTenant,
  listScheduleEntriesForCampaign,
  updateScheduleEntryCampaignId,
  updateScheduleEntryFields,
} from "../db/schedule-entry.js";

export type CampaignHttpSuccess<T> = {
  readonly ok: true;
  readonly status: number;
  readonly body: T;
};

export type CampaignHttpError = {
  readonly ok: false;
  readonly status: number;
  readonly body: unknown;
};

export type CampaignHttpOutcome = CampaignHttpSuccess<unknown> | CampaignHttpError;

export const ListCampaignsQuerySchema = z
  .object({
    tenantId: z.string().min(1).max(120),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  })
  .strict();

export const GetCampaignQuerySchema = z
  .object({
    tenantId: z.string().min(1).max(120),
    campaignId: z.string().min(1).max(120),
  })
  .strict();

export async function executeCreateCampaignRequest(
  body: unknown,
): Promise<CampaignHttpOutcome> {
  const parsed = CreateCampaignBodySchema.safeParse(body);
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
  const { tenantId, campaignId, name, status } = parsed.data;
  const statusToStore = status ?? "draft";
  const inserted = await insertCampaign({
    tenantId,
    campaignId,
    name,
    status: statusToStore,
  });
  if (inserted.mode === "error") {
    if (inserted.code === "no_database") {
      return {
        ok: false,
        status: 503,
        body: {
          error: "database_required",
          message: "DATABASE_URL is not set; cannot persist campaigns.",
        },
      };
    }
    if (inserted.code === "duplicate") {
      return {
        ok: false,
        status: 409,
        body: { error: "duplicate_campaign", message: inserted.message },
      };
    }
    return {
      ok: false,
      status: 500,
      body: { error: "database_insert", message: inserted.message },
    };
  }
  return {
    ok: true,
    status: 201,
    body: { campaign: inserted.record },
  };
}

export async function executeListCampaignsRequestFromSearchParams(
  searchParams: URLSearchParams,
): Promise<CampaignHttpOutcome> {
  const parsed = ListCampaignsQuerySchema.safeParse(
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
  const { tenantId, limit } = parsed.data;
  const listed = await listCampaignsByTenant(tenantId, limit);
  if (listed.mode === "no_database") {
    return {
      ok: false,
      status: 503,
      body: {
        error: "database_required",
        message: "DATABASE_URL is not set; cannot list campaigns.",
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
    body: { campaigns: listed.rows },
  };
}

export async function executeListScheduleEntriesForCampaignRequestFromSearchParams(
  searchParams: URLSearchParams,
): Promise<CampaignHttpOutcome> {
  const parsed = ListScheduleEntriesForCampaignQuerySchema.safeParse(
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
  const { tenantId, campaignId, limit } = parsed.data;
  const listed = await listScheduleEntriesForCampaign({
    tenantId,
    campaignId,
    limit,
  });
  if (listed.mode === "no_database") {
    return {
      ok: false,
      status: 503,
      body: {
        error: "database_required",
        message: "DATABASE_URL is not set; cannot list schedule entries.",
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
      scheduleEntries: listed.rows.map((row) =>
        scheduleEntryRecordFromSqlRow(row),
      ),
    },
  };
}

export async function executeGetCampaignRequestFromSearchParams(
  searchParams: URLSearchParams,
): Promise<CampaignHttpOutcome> {
  const parsed = GetCampaignQuerySchema.safeParse(
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
  const { tenantId, campaignId } = parsed.data;
  const resolved = await resolveCampaign(tenantId, campaignId);
  if (resolved.mode === "no_database") {
    return {
      ok: false,
      status: 503,
      body: {
        error: "database_required",
        message: "DATABASE_URL is not set; cannot load campaigns.",
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
  return {
    ok: true,
    status: 200,
    body: { campaign: resolved.row },
  };
}

export async function executeCreateScheduleEntryRequest(
  body: unknown,
): Promise<CampaignHttpOutcome> {
  const parsed = CreateScheduleEntryBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: { error: "validation_error", message: parsed.error.message },
    };
  }
  const { tenantId, scheduleEntryId, campaignId, network, status, contentSummary, scheduledAt } =
    parsed.data;
  const inserted = await insertScheduleEntry({
    tenantId,
    scheduleEntryId,
    campaignId: campaignId ?? null,
    network: network ?? null,
    status,
    contentSummary: contentSummary ?? null,
    scheduledAt: scheduledAt ?? null,
  });
  if (!inserted.ok) {
    if (inserted.code === "no_database") {
      return {
        ok: false,
        status: 503,
        body: { error: "database_required", message: "DATABASE_URL is not set." },
      };
    }
    if (inserted.code === "duplicate") {
      return {
        ok: false,
        status: 409,
        body: { error: "duplicate_schedule_entry", message: inserted.message },
      };
    }
    if (inserted.code === "campaign_not_found") {
      return { ok: false, status: 404, body: { error: "campaign_not_found" } };
    }
    return {
      ok: false,
      status: 500,
      body: { error: "database_insert", message: inserted.message },
    };
  }
  return {
    ok: true,
    status: 201,
    body: { scheduleEntry: scheduleEntryRecordFromSqlRow(inserted.row) },
  };
}

export async function executeListScheduleEntriesByTenantRequestFromSearchParams(
  searchParams: URLSearchParams,
): Promise<CampaignHttpOutcome> {
  const parsed = ListScheduleEntriesByTenantQuerySchema.safeParse(
    Object.fromEntries(searchParams.entries()),
  );
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: { error: "validation_error", message: parsed.error.message },
    };
  }
  const { tenantId, limit } = parsed.data;
  const listed = await listScheduleEntriesByTenant({ tenantId, limit });
  if (listed.mode === "no_database") {
    return {
      ok: false,
      status: 503,
      body: {
        error: "database_required",
        message: "DATABASE_URL is not set; cannot list schedule entries.",
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
      scheduleEntries: listed.rows.map((row) =>
        scheduleEntryRecordFromSqlRow(row),
      ),
    },
  };
}

export async function executeDeleteScheduleEntryRequest(
  body: unknown,
): Promise<CampaignHttpOutcome> {
  const parsed = DeleteScheduleEntryBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: { error: "validation_error", message: parsed.error.message },
    };
  }
  const { tenantId, scheduleEntryId } = parsed.data;
  const result = await deleteScheduleEntry({ tenantId, scheduleEntryId });
  if (!result.ok) {
    if (result.code === "no_database") {
      return {
        ok: false,
        status: 503,
        body: { error: "database_required", message: "DATABASE_URL is not set." },
      };
    }
    if (result.code === "not_found") {
      return { ok: false, status: 404, body: { error: "not_found" } };
    }
    return {
      ok: false,
      status: 500,
      body: { error: "database_delete", message: result.message },
    };
  }
  return { ok: true, status: 200, body: { deleted: true } };
}

export async function executeUpdateScheduleEntryRequest(
  body: unknown,
): Promise<CampaignHttpOutcome> {
  const parsed = UpdateScheduleEntryBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: { error: "validation_error", message: parsed.error.message },
    };
  }
  const { tenantId, scheduleEntryId, contentSummary, network, scheduledAt, videoOptions, metadata } =
    parsed.data;
  const result = await updateScheduleEntryFields({
    tenantId,
    scheduleEntryId,
    contentSummary: contentSummary ?? null,
    network: network ?? null,
    scheduledAt: scheduledAt ?? null,
    videoOptions: videoOptions ?? null,
    metadata: metadata ?? null,
  });
  if (!result.ok) {
    if (result.code === "no_database") {
      return {
        ok: false,
        status: 503,
        body: { error: "database_required", message: "DATABASE_URL is not set." },
      };
    }
    if (result.code === "not_found") {
      return { ok: false, status: 404, body: { error: "not_found" } };
    }
    return {
      ok: false,
      status: 500,
      body: { error: "database_update", message: result.message },
    };
  }
  return {
    ok: true,
    status: 200,
    body: { scheduleEntry: scheduleEntryRecordFromSqlRow(result.row) },
  };
}

export async function executeAttachScheduleEntryCampaignRequest(
  body: unknown,
): Promise<CampaignHttpOutcome> {
  const parsed = AttachScheduleEntryCampaignBodySchema.safeParse(body);
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
  const { tenantId, scheduleEntryId, campaignId } = parsed.data;
  const updated = await updateScheduleEntryCampaignId({
    tenantId,
    scheduleEntryId,
    campaignId,
  });
  if (!updated.ok) {
    if (updated.code === "no_database") {
      return {
        ok: false,
        status: 503,
        body: {
          error: "database_required",
          message: "DATABASE_URL is not set; cannot update schedule entries.",
        },
      };
    }
    if (updated.code === "not_found") {
      return {
        ok: false,
        status: 404,
        body: { error: "schedule_entry_not_found" },
      };
    }
    if (updated.code === "campaign_not_found") {
      return {
        ok: false,
        status: 404,
        body: { error: "campaign_not_found" },
      };
    }
    if (updated.code === "foreign_key_violation") {
      return {
        ok: false,
        status: 409,
        body: { error: "foreign_key_violation", message: updated.message },
      };
    }
    return {
      ok: false,
      status: 500,
      body: { error: "database_update", message: updated.message },
    };
  }
  return {
    ok: true,
    status: 200,
    body: {
      scheduleEntry: scheduleEntryRecordFromSqlRow(updated.row),
    },
  };
}
