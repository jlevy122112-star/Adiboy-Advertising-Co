/**
 * Persistence for generated_assets (Phase 6 — migration 013).
 */

import { getPostgresClient } from "./postgres.js";

export type GeneratedAssetStatus =
  | "generating"
  | "moderation_pending"
  | "approved"
  | "rejected"
  | "failed";

export type GeneratedAssetRow = {
  id: string;
  tenant_id: string;
  schedule_entry_id: string | null;
  brief_id: string | null;
  provider: string;
  prompt: string;
  revised_prompt: string | null;
  s3_key: string | null;
  url: string | null;
  width: number | null;
  height: number | null;
  network: string | null;
  status: GeneratedAssetStatus;
  moderation_flagged: boolean;
  moderation_detail: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type InsertGeneratedAssetInput = {
  id: string;
  tenantId: string;
  scheduleEntryId?: string | null;
  briefId?: string | null;
  provider: string;
  prompt: string;
  revisedPrompt?: string | null;
  s3Key?: string | null;
  url?: string | null;
  width?: number | null;
  height?: number | null;
  network?: string | null;
  status: GeneratedAssetStatus;
  moderationFlagged?: boolean;
  moderationDetail?: Record<string, unknown> | null;
  error?: string | null;
};

const SELECT_COLS = `
  id, tenant_id, schedule_entry_id, brief_id, provider, prompt, revised_prompt,
  s3_key, url, width, height, network, status, moderation_flagged,
  moderation_detail, error, created_at, updated_at
`;

export async function insertGeneratedAsset(
  input: InsertGeneratedAssetInput,
): Promise<GeneratedAssetRow | null> {
  const sql = getPostgresClient();
  if (!sql) return null;

  const rows = await sql<GeneratedAssetRow[]>`
    INSERT INTO generated_assets
      (id, tenant_id, schedule_entry_id, brief_id, provider, prompt, revised_prompt,
       s3_key, url, width, height, network, status, moderation_flagged,
       moderation_detail, error, created_at, updated_at)
    VALUES
      (${input.id}, ${input.tenantId}, ${input.scheduleEntryId ?? null},
       ${input.briefId ?? null}, ${input.provider}, ${input.prompt},
       ${input.revisedPrompt ?? null}, ${input.s3Key ?? null}, ${input.url ?? null},
       ${input.width ?? null}, ${input.height ?? null}, ${input.network ?? null},
       ${input.status}, ${input.moderationFlagged ?? false},
       ${input.moderationDetail ? sql.json(input.moderationDetail as Parameters<typeof sql.json>[0]) : null},
       ${input.error ?? null}, now(), now())
    RETURNING ${sql.unsafe(SELECT_COLS)}
  `;
  return rows[0] ?? null;
}

export async function updateGeneratedAsset(
  tenantId: string,
  id: string,
  patch: Partial<Pick<InsertGeneratedAssetInput,
    "status" | "revisedPrompt" | "s3Key" | "url" | "moderationFlagged" | "moderationDetail" | "error"
  >>,
): Promise<GeneratedAssetRow | null> {
  const sql = getPostgresClient();
  if (!sql) return null;

  const rows = await sql<GeneratedAssetRow[]>`
    UPDATE generated_assets SET
      status              = COALESCE(${patch.status ?? null}, status),
      revised_prompt      = COALESCE(${patch.revisedPrompt ?? null}, revised_prompt),
      s3_key              = COALESCE(${patch.s3Key ?? null}, s3_key),
      url                 = COALESCE(${patch.url ?? null}, url),
      moderation_flagged  = COALESCE(${patch.moderationFlagged ?? null}, moderation_flagged),
      moderation_detail   = COALESCE(${patch.moderationDetail ? sql.json(patch.moderationDetail as Parameters<typeof sql.json>[0]) : null}, moderation_detail),
      error               = COALESCE(${patch.error ?? null}, error),
      updated_at          = now()
    WHERE tenant_id = ${tenantId} AND id = ${id}
    RETURNING ${sql.unsafe(SELECT_COLS)}
  `;
  return rows[0] ?? null;
}

export async function getGeneratedAsset(
  tenantId: string,
  id: string,
): Promise<GeneratedAssetRow | null> {
  const sql = getPostgresClient();
  if (!sql) return null;

  const rows = await sql<GeneratedAssetRow[]>`
    SELECT ${sql.unsafe(SELECT_COLS)} FROM generated_assets
    WHERE tenant_id = ${tenantId} AND id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listGeneratedAssets(args: {
  tenantId: string;
  scheduleEntryId?: string;
  briefId?: string;
  limit?: number;
}): Promise<GeneratedAssetRow[]> {
  const sql = getPostgresClient();
  if (!sql) return [];

  const lim = Math.min(Math.max(1, args.limit ?? 20), 100);

  if (args.scheduleEntryId) {
    return sql<GeneratedAssetRow[]>`
      SELECT ${sql.unsafe(SELECT_COLS)} FROM generated_assets
      WHERE tenant_id = ${args.tenantId}
        AND schedule_entry_id = ${args.scheduleEntryId}
      ORDER BY created_at DESC LIMIT ${lim}
    `;
  }
  if (args.briefId) {
    return sql<GeneratedAssetRow[]>`
      SELECT ${sql.unsafe(SELECT_COLS)} FROM generated_assets
      WHERE tenant_id = ${args.tenantId}
        AND brief_id = ${args.briefId}
      ORDER BY created_at DESC LIMIT ${lim}
    `;
  }
  return sql<GeneratedAssetRow[]>`
    SELECT ${sql.unsafe(SELECT_COLS)} FROM generated_assets
    WHERE tenant_id = ${args.tenantId}
    ORDER BY created_at DESC LIMIT ${lim}
  `;
}
