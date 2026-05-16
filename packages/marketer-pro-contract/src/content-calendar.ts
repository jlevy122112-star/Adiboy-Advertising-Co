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

/** Hashtags, mentions, alt text, and platform-specific extras (migration `011`). */
export const PostMetadataSchema = z
  .object({
    hashtags: z.array(z.string().max(100)).max(30).optional().default([]),
    mentions: z.array(z.string().max(100)).max(20).optional().default([]),
    altText: z.string().max(1000).optional().default(""),
    /** Instagram: location tag */
    location: z.string().max(200).optional().default(""),
    /** LinkedIn: text to post as first comment (common hashtag strategy) */
    firstComment: z.string().max(2200).optional().default(""),
    /** LinkedIn: article/post title when sharing a link */
    articleTitle: z.string().max(300).optional().default(""),
    /** YouTube: long-form description separate from the post body */
    youtubeDescription: z.string().max(5000).optional().default(""),
    /** YouTube: searchable tag keywords */
    youtubeTags: z.array(z.string().max(100)).max(500).optional().default([]),
    /** YouTube: category name or ID (e.g. "22" = People & Blogs) */
    youtubeCategory: z.string().max(100).optional().default(""),
  })
  .strict();

export type PostMetadata = z.infer<typeof PostMetadataSchema>;

/** Video build options stored per schedule entry (migration `009`). */
export const VideoOptionsSchema = z
  .object({
    filterPreset: z.string().max(64).optional().default("none"),
    textTitle: z.string().max(80).optional().default(""),
    textCaption: z.string().max(200).optional().default(""),
    textHashtags: z.string().max(120).optional().default(""),
    textEmoji: z.string().max(8).optional().default(""),
    effects: z.array(z.string().max(64)).max(10).optional().default([]),
  })
  .strict();

export type VideoOptions = z.infer<typeof VideoOptionsSchema>;

/** Row shape returned by `SELECT` on `schedule_entries` (snake_case). */
export type ScheduleEntrySqlRow = {
  readonly id: string;
  readonly tenant_id: string;
  /** Optional FK to `campaigns` (migration `003`). */
  readonly campaign_id: string | null;
  readonly network: string | null;
  readonly status: string;
  readonly content_summary: string | null;
  /** When the post should go live; added in migration `007`. */
  readonly scheduled_at: string | Date | null;
  /** Video build options; added in migration `009`. */
  readonly video_options?: unknown | null;
  /** Post metadata (hashtags, mentions, alt text, platform extras); migration `011`. */
  readonly metadata?: unknown | null;
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
    /** ISO datetime for when the post is scheduled to go live (migration 007). */
    scheduledAt: z.string().nullable().optional(),
    /** Video build options (migration 009). */
    videoOptions: VideoOptionsSchema.nullable().optional(),
    /** Post metadata: hashtags, mentions, alt text, platform extras (migration 011). */
    metadata: PostMetadataSchema.nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
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
    scheduledAt: row.scheduled_at != null ? toIsoString(row.scheduled_at) : null,
    videoOptions: row.video_options != null
      ? VideoOptionsSchema.parse(row.video_options)
      : null,
    metadata: row.metadata != null
      ? PostMetadataSchema.parse(row.metadata)
      : null,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  });
}

/** POST body: create a new `schedule_entries` row. */
export const CreateScheduleEntryBodySchema = z
  .object({
    tenantId: z.string().min(1).max(120),
    /** Caller-supplied UUID (idempotent upsert). */
    scheduleEntryId: z.string().min(1).max(120),
    campaignId: z.union([z.string().min(1).max(120), z.null()]).optional().default(null),
    network: z.string().min(1).max(64).nullable().optional().default(null),
    status: ScheduleEntryStatusSchema.optional().default("draft"),
    contentSummary: z.string().max(20_000).nullable().optional().default(null),
    /** ISO datetime when this post should go live. */
    scheduledAt: z.string().nullable().optional().default(null),
  })
  .strict();

export type CreateScheduleEntryBody = z.infer<typeof CreateScheduleEntryBodySchema>;

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

/** GET query: list all `schedule_entries` for a tenant (calendar view — no campaign filter). */
export const ListScheduleEntriesByTenantQuerySchema = z
  .object({
    tenantId: z.string().min(1).max(120),
    limit: z.coerce.number().int().min(1).max(500).optional().default(200),
  })
  .strict();

export type ListScheduleEntriesByTenantQuery = z.infer<
  typeof ListScheduleEntriesByTenantQuerySchema
>;

/** POST body: delete a single `schedule_entries` row. */
export const DeleteScheduleEntryBodySchema = z
  .object({
    tenantId: z.string().min(1).max(120),
    scheduleEntryId: z.string().min(1).max(120),
  })
  .strict();

export type DeleteScheduleEntryBody = z.infer<
  typeof DeleteScheduleEntryBodySchema
>;

/** POST body: update mutable fields on a `schedule_entries` row (calendar sync). */
export const UpdateScheduleEntryBodySchema = z
  .object({
    tenantId: z.string().min(1).max(120),
    scheduleEntryId: z.string().min(1).max(120),
    contentSummary: z.string().max(20_000).nullable().optional(),
    network: z.string().min(1).max(64).nullable().optional(),
    scheduledAt: z.string().nullable().optional(),
    videoOptions: VideoOptionsSchema.nullable().optional(),
    metadata: PostMetadataSchema.nullable().optional(),
  })
  .strict();

export type UpdateScheduleEntryBody = z.infer<
  typeof UpdateScheduleEntryBodySchema
>;
