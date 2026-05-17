/**
 * DB layer for generation_presets — named reusable generation templates.
 */

import { getPostgresClient } from "./postgres.js";

export type GenerationPresetRow = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  gen_type: string;
  platform: string | null;
  headline: string | null;
  body: string | null;
  cta: string | null;
  mood: string | null;
  imagery_direction: string | null;
  custom_tagline: string | null;
  tone_shift: string | null;
  voiceover: boolean;
  quality: string | null;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type InsertPresetInput = {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  genType?: string;
  platform?: string;
  headline?: string;
  body?: string;
  cta?: string;
  mood?: string;
  imageryDirection?: string;
  customTagline?: string;
  toneShift?: string;
  voiceover?: boolean;
  quality?: string;
};

export async function insertGenerationPreset(
  input: InsertPresetInput,
): Promise<GenerationPresetRow | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<GenerationPresetRow[]>`
      INSERT INTO generation_presets (
        id, tenant_id, name, description, gen_type, platform,
        headline, body, cta, mood, imagery_direction, custom_tagline,
        tone_shift, voiceover, quality
      ) VALUES (
        ${input.id}, ${input.tenantId}, ${input.name},
        ${input.description ?? null}, ${input.genType ?? "video"},
        ${input.platform ?? null}, ${input.headline ?? null},
        ${input.body ?? null}, ${input.cta ?? null},
        ${input.mood ?? null}, ${input.imageryDirection ?? null},
        ${input.customTagline ?? null}, ${input.toneShift ?? null},
        ${input.voiceover ?? false}, ${input.quality ?? null}
      )
      RETURNING *
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function listGenerationPresets(
  tenantId: string,
  genType?: string,
  limit = 20,
): Promise<GenerationPresetRow[]> {
  const sql = getPostgresClient();
  if (!sql) return [];
  const lim = Math.min(Math.max(1, limit), 50);
  try {
    if (genType) {
      return await sql<GenerationPresetRow[]>`
        SELECT * FROM generation_presets
        WHERE tenant_id = ${tenantId} AND gen_type = ${genType}
        ORDER BY last_used_at DESC NULLS LAST, updated_at DESC
        LIMIT ${lim}
      `;
    }
    return await sql<GenerationPresetRow[]>`
      SELECT * FROM generation_presets
      WHERE tenant_id = ${tenantId}
      ORDER BY last_used_at DESC NULLS LAST, updated_at DESC
      LIMIT ${lim}
    `;
  } catch {
    return [];
  }
}

export async function getGenerationPreset(
  tenantId: string,
  id: string,
): Promise<GenerationPresetRow | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<GenerationPresetRow[]>`
      SELECT * FROM generation_presets
      WHERE tenant_id = ${tenantId} AND id = ${id}
      LIMIT 1
    `;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function touchPresetUsed(
  tenantId: string,
  id: string,
): Promise<void> {
  const sql = getPostgresClient();
  if (!sql) return;
  try {
    await sql`
      UPDATE generation_presets
      SET use_count = use_count + 1, last_used_at = now(), updated_at = now()
      WHERE tenant_id = ${tenantId} AND id = ${id}
    `;
  } catch { /* non-critical */ }
}

export async function deleteGenerationPreset(
  tenantId: string,
  id: string,
): Promise<boolean> {
  const sql = getPostgresClient();
  if (!sql) return false;
  try {
    const rows = await sql<{ id: string }[]>`
      DELETE FROM generation_presets
      WHERE tenant_id = ${tenantId} AND id = ${id}
      RETURNING id
    `;
    return rows.length > 0;
  } catch {
    return false;
  }
}
