/**
 * Calendar / schedule row contracts aligned with Postgres `schedule_entries`
 * (`apps/api/db/migrations/001_schedule_entries.sql`, composite PK in `002`,
 * optional `campaign_id` in `003`).
 *
 * UI monthly rows use {@link MarketerScheduleEntrySchema} in `index.ts`; this
 * module is the durable-store shape for publish worker lookups and future APIs.
 */

import { z } from "zod";

/** Status values the worker and migrations use today; extend as lifecycle grows. */
export const SCHEDULE_ENTRY_STATUS_VALUES = [
  "scheduled",
  "published",
  "failed",
  "draft",
  "pending_review",
  "approved",
  "queued",
  "publishing",
  "cancelled",
] as const;

export type ScheduleEntryStatus = (typeof SCHEDULE_ENTRY_STATUS_VALUES)[number];

export const ScheduleEntryStatusSchema = z.enum(SCHEDULE_ENTRY_STATUS_VALUES);

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/** Row shape returned by `SELECT` on `schedule_entries` (snake_case). */
export type ScheduleEntrySqlRow = {
  readonly id: string;
  readonly tenant_id: string;
  /** Optional FK to `campaigns` (migration `003`). */
  readonly campaign_id: string | null;
  readonly network: string | null;
  readonly status: string;
  readonly content_summary: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
};

/**
 * Public / camelCase record for APIs and cross-package interchange.
 * `status` stays a string so older DB rows remain representable until a stricter migration lands.
 */
export const ScheduleEntryRecordSchema = z
  .object({
    tenantId: z.string().min(1),
    scheduleEntryId: z.string().min(1),
    campaignId: z.union([z.string().min(1).max(256), z.null()]),
    network: z.string().min(1).nullable(),
    status: z.string().min(1).max(64),
    contentSummary: z.string().max(20_000).nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type ScheduleEntryRecord = z.infer<typeof ScheduleEntryRecordSchema>;

export function scheduleEntryRecordFromSqlRow(
  row: ScheduleEntrySqlRow,
): ScheduleEntryRecord {
  return ScheduleEntryRecordSchema.parse({
    tenantId: row.tenant_id,
    scheduleEntryId: row.id,
    campaignId: row.campaign_id,
    network: row.network,
    status: row.status,
    contentSummary: row.content_summary,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  });
}

/** True when `status` is one of the known enum values (strict checks / UI badges). */
export function isKnownScheduleEntryStatus(
  status: string,
): status is ScheduleEntryStatus {
  return (SCHEDULE_ENTRY_STATUS_VALUES as readonly string[]).includes(status);
}

/** Lifecycle endpoints — no further forward progress in the calendar model. */
export const TERMINAL_SCHEDULE_ENTRY_STATUSES = [
  "published",
  "failed",
  "cancelled",
] as const;

export type TerminalScheduleEntryStatus =
  (typeof TERMINAL_SCHEDULE_ENTRY_STATUSES)[number];

export function isTerminalScheduleEntryStatus(
  status: string,
): status is TerminalScheduleEntryStatus {
  return (TERMINAL_SCHEDULE_ENTRY_STATUSES as readonly string[]).includes(
    status,
  );
}

/** POST body: link or unlink a `schedule_entries` row to a tenant `campaigns` row. */
export const AttachScheduleEntryCampaignBodySchema = z
  .object({
    tenantId: z.string().min(1).max(120),
    scheduleEntryId: z.string().min(1).max(120),
    /** Campaign id under the same tenant, or `null` to clear `campaign_id`. */
    campaignId: z.union([z.string().min(1).max(120), z.null()]),
  })
  .strict();

export type AttachScheduleEntryCampaignBody = z.infer<
  typeof AttachScheduleEntryCampaignBodySchema
>;

/** GET query: list `schedule_entries` rows linked to a tenant campaign (`campaign_id` FK). */
export const ListScheduleEntriesForCampaignQuerySchema = z
  .object({
    tenantId: z.string().min(1).max(120),
    campaignId: z.string().min(1).max(120),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  })
  .strict();

export type ListScheduleEntriesForCampaignQuery = z.infer<
  typeof ListScheduleEntriesForCampaignQuerySchema
>;
