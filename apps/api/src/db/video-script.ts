/**
 * Persistence for video_scripts and video_render_jobs (Phase 7 — migration 014).
 */

import { getPostgresClient } from "./postgres.js";
import type { VideoScene, VideoScriptStatus, VideoRenderJobStatus } from "@home-link/marketer-pro-contract";

export type VideoScriptRow = {
  id: string;
  tenant_id: string;
  brief_id: string | null;
  platform: string;
  title: string;
  scenes_json: VideoScene[];
  hashtags_json: string[];
  voiceover_enabled: boolean;
  total_duration_s: number;
  status: VideoScriptStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type VideoRenderJobRow = {
  id: string;
  tenant_id: string;
  script_id: string;
  s3_key: string | null;
  url: string | null;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  duration_s: number | null;
  status: VideoRenderJobStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
};

const SCRIPT_COLS = `
  id, tenant_id, brief_id, platform, title, scenes_json, hashtags_json,
  voiceover_enabled, total_duration_s, status, error, created_at, updated_at
`;

const JOB_COLS = `
  id, tenant_id, script_id, s3_key, url, thumbnail_url, width, height, duration_s,
  status, error, created_at, updated_at
`;

export async function insertVideoScript(input: {
  id: string;
  tenantId: string;
  briefId?: string | null;
  platform: string;
  title: string;
  scenes: VideoScene[];
  hashtags: string[];
  voiceoverEnabled: boolean;
  totalDurationS: number;
  status: VideoScriptStatus;
}): Promise<VideoScriptRow | null> {
  const sql = getPostgresClient();
  if (!sql) return null;

  const rows = await sql<VideoScriptRow[]>`
    INSERT INTO video_scripts
      (id, tenant_id, brief_id, platform, title, scenes_json, hashtags_json,
       voiceover_enabled, total_duration_s, status, created_at, updated_at)
    VALUES
      (${input.id}, ${input.tenantId}, ${input.briefId ?? null},
       ${input.platform}, ${input.title},
       ${sql.json(input.scenes as unknown as Parameters<typeof sql.json>[0])},
       ${sql.json(input.hashtags as unknown as Parameters<typeof sql.json>[0])},
       ${input.voiceoverEnabled}, ${input.totalDurationS},
       ${input.status}, now(), now())
    RETURNING ${sql.unsafe(SCRIPT_COLS)}
  `;
  return rows[0] ?? null;
}

export async function updateVideoScript(
  tenantId: string,
  id: string,
  patch: {
    status?: VideoScriptStatus;
    scenes?: VideoScene[];
    title?: string;
    totalDurationS?: number;
    error?: string | null;
  },
): Promise<VideoScriptRow | null> {
  const sql = getPostgresClient();
  if (!sql) return null;

  const rows = await sql<VideoScriptRow[]>`
    UPDATE video_scripts SET
      status          = COALESCE(${patch.status ?? null}, status),
      title           = COALESCE(${patch.title ?? null}, title),
      scenes_json     = COALESCE(${patch.scenes ? sql.json(patch.scenes as unknown as Parameters<typeof sql.json>[0]) : null}, scenes_json),
      total_duration_s= COALESCE(${patch.totalDurationS ?? null}, total_duration_s),
      error           = COALESCE(${patch.error ?? null}, error),
      updated_at      = now()
    WHERE tenant_id = ${tenantId} AND id = ${id}
    RETURNING ${sql.unsafe(SCRIPT_COLS)}
  `;
  return rows[0] ?? null;
}

export async function getVideoScript(tenantId: string, id: string): Promise<VideoScriptRow | null> {
  const sql = getPostgresClient();
  if (!sql) return null;

  const rows = await sql<VideoScriptRow[]>`
    SELECT ${sql.unsafe(SCRIPT_COLS)} FROM video_scripts
    WHERE tenant_id = ${tenantId} AND id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listVideoScripts(args: {
  tenantId: string;
  briefId?: string;
  limit?: number;
}): Promise<VideoScriptRow[]> {
  const sql = getPostgresClient();
  if (!sql) return [];

  const lim = Math.min(Math.max(1, args.limit ?? 20), 100);

  if (args.briefId) {
    return sql<VideoScriptRow[]>`
      SELECT ${sql.unsafe(SCRIPT_COLS)} FROM video_scripts
      WHERE tenant_id = ${args.tenantId} AND brief_id = ${args.briefId}
      ORDER BY created_at DESC LIMIT ${lim}
    `;
  }
  return sql<VideoScriptRow[]>`
    SELECT ${sql.unsafe(SCRIPT_COLS)} FROM video_scripts
    WHERE tenant_id = ${args.tenantId}
    ORDER BY created_at DESC LIMIT ${lim}
  `;
}

export async function insertVideoRenderJob(input: {
  id: string;
  tenantId: string;
  scriptId: string;
  width: number;
  height: number;
  status: VideoRenderJobStatus;
}): Promise<VideoRenderJobRow | null> {
  const sql = getPostgresClient();
  if (!sql) return null;

  const rows = await sql<VideoRenderJobRow[]>`
    INSERT INTO video_render_jobs
      (id, tenant_id, script_id, width, height, status, created_at, updated_at)
    VALUES
      (${input.id}, ${input.tenantId}, ${input.scriptId},
       ${input.width}, ${input.height}, ${input.status}, now(), now())
    RETURNING ${sql.unsafe(JOB_COLS)}
  `;
  return rows[0] ?? null;
}

export async function updateVideoRenderJob(
  tenantId: string,
  id: string,
  patch: {
    status?: VideoRenderJobStatus;
    s3Key?: string | null;
    url?: string | null;
    thumbnailUrl?: string | null;
    durationS?: number | null;
    error?: string | null;
  },
): Promise<VideoRenderJobRow | null> {
  const sql = getPostgresClient();
  if (!sql) return null;

  const rows = await sql<VideoRenderJobRow[]>`
    UPDATE video_render_jobs SET
      status        = COALESCE(${patch.status ?? null}, status),
      s3_key        = COALESCE(${patch.s3Key ?? null}, s3_key),
      url           = COALESCE(${patch.url ?? null}, url),
      thumbnail_url = COALESCE(${patch.thumbnailUrl ?? null}, thumbnail_url),
      duration_s    = COALESCE(${patch.durationS ?? null}, duration_s),
      error         = COALESCE(${patch.error ?? null}, error),
      updated_at    = now()
    WHERE tenant_id = ${tenantId} AND id = ${id}
    RETURNING ${sql.unsafe(JOB_COLS)}
  `;
  return rows[0] ?? null;
}

export async function getVideoRenderJob(tenantId: string, id: string): Promise<VideoRenderJobRow | null> {
  const sql = getPostgresClient();
  if (!sql) return null;

  const rows = await sql<VideoRenderJobRow[]>`
    SELECT ${sql.unsafe(JOB_COLS)} FROM video_render_jobs
    WHERE tenant_id = ${tenantId} AND id = ${id}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function listVideoRenderJobs(args: {
  tenantId: string;
  scriptId?: string;
  limit?: number;
}): Promise<VideoRenderJobRow[]> {
  const sql = getPostgresClient();
  if (!sql) return [];

  const lim = Math.min(Math.max(1, args.limit ?? 20), 100);

  if (args.scriptId) {
    return sql<VideoRenderJobRow[]>`
      SELECT ${sql.unsafe(JOB_COLS)} FROM video_render_jobs
      WHERE tenant_id = ${args.tenantId} AND script_id = ${args.scriptId}
      ORDER BY created_at DESC LIMIT ${lim}
    `;
  }
  return sql<VideoRenderJobRow[]>`
    SELECT ${sql.unsafe(JOB_COLS)} FROM video_render_jobs
    WHERE tenant_id = ${args.tenantId}
    ORDER BY created_at DESC LIMIT ${lim}
  `;
}
