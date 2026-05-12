/**
 * Campaign container contracts (Phase 4 — unified content calendar).
 *
 * A campaign groups schedule slots across networks under one tenant-scoped id.
 * Rows live in Postgres `campaigns` (see `apps/api/db/migrations/003_*`).
 */

import { z } from "zod";

/** Product lifecycle for a campaign aggregate (review gates, go-live, wind-down). */
export const CAMPAIGN_STATUS_VALUES = [
  "draft",
  "pending_review",
  "approved",
  "active",
  "completed",
  "cancelled",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUS_VALUES)[number];

export const CampaignStatusSchema = z.enum(CAMPAIGN_STATUS_VALUES);

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

export type CampaignSqlRow = {
  readonly id: string;
  readonly tenant_id: string;
  readonly name: string;
  readonly status: string;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
};

export const CampaignRecordSchema = z
  .object({
    tenantId: z.string().min(1),
    campaignId: z.string().min(1),
    name: z.string().min(1).max(500),
    status: z.string().min(1).max(64),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type CampaignRecord = z.infer<typeof CampaignRecordSchema>;

export function campaignRecordFromSqlRow(row: CampaignSqlRow): CampaignRecord {
  return CampaignRecordSchema.parse({
    tenantId: row.tenant_id,
    campaignId: row.id,
    name: row.name,
    status: row.status,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  });
}

export function isKnownCampaignStatus(status: string): status is CampaignStatus {
  return (CAMPAIGN_STATUS_VALUES as readonly string[]).includes(status);
}

/** HTTP / JSON body for creating a tenant-scoped campaign row (`campaigns`). */
export const CreateCampaignBodySchema = z
  .object({
    tenantId: z.string().min(1).max(120),
    campaignId: z.string().min(1).max(120),
    name: z.string().min(1).max(500),
    status: CampaignStatusSchema.optional(),
  })
  .strict();

export type CreateCampaignBody = z.infer<typeof CreateCampaignBodySchema>;
