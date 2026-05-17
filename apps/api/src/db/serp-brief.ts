import { getPostgresClient } from "./postgres.js";
import type { SerpBrief } from "@home-link/marketer-pro-contract";

type SerpBriefRow = {
  id: string;
  tenant_id: string;
  keyword: string;
  status: string;
  serp_json: unknown;
  analysis_json: unknown;
  error: string | null;
  created_at: string;
  updated_at: string;
};

function rowToBrief(row: SerpBriefRow): SerpBrief {
  const serp = (row.serp_json ?? {}) as Record<string, unknown>;
  const analysis = (row.analysis_json ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    keyword: row.keyword,
    status: row.status as SerpBrief["status"],
    serpResults: serp.results as SerpBrief["serpResults"],
    intent: serp.intent as SerpBrief["intent"],
    competitorAngles: analysis.competitorAngles as SerpBrief["competitorAngles"],
    contentGaps: analysis.contentGaps as SerpBrief["contentGaps"],
    suggestedHeadline: analysis.suggestedHeadline as string | undefined,
    suggestedAngle: analysis.suggestedAngle as string | undefined,
    suggestedOutline: analysis.suggestedOutline as string[] | undefined,
    targetKeywords: analysis.targetKeywords as string[] | undefined,
    seoScore: analysis.seoScore as number | undefined,
    seoScoreReason: analysis.seoScoreReason as string | undefined,
    error: row.error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertSerpBrief(
  id: string,
  tenantId: string,
  keyword: string,
): Promise<SerpBrief | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<SerpBriefRow[]>`
      INSERT INTO serp_briefs (id, tenant_id, keyword, status)
      VALUES (${id}, ${tenantId}, ${keyword}, 'pending')
      RETURNING *
    `;
    return rows[0] ? rowToBrief(rows[0]) : null;
  } catch { return null; }
}

export async function updateSerpBrief(
  id: string,
  tenantId: string,
  patch: {
    status?: string;
    serpJson?: unknown;
    analysisJson?: unknown;
    error?: string;
  },
): Promise<SerpBrief | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<SerpBriefRow[]>`
      UPDATE serp_briefs SET
        status       = COALESCE(${patch.status ?? null}, status),
        serp_json    = COALESCE(${patch.serpJson ? sql.json(patch.serpJson as unknown as Parameters<typeof sql.json>[0]) : null}, serp_json),
        analysis_json = COALESCE(${patch.analysisJson ? sql.json(patch.analysisJson as unknown as Parameters<typeof sql.json>[0]) : null}, analysis_json),
        error        = COALESCE(${patch.error ?? null}, error),
        updated_at   = now()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *
    `;
    return rows[0] ? rowToBrief(rows[0]) : null;
  } catch { return null; }
}

export async function getSerpBrief(
  tenantId: string,
  id: string,
): Promise<SerpBrief | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<SerpBriefRow[]>`
      SELECT * FROM serp_briefs WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1
    `;
    return rows[0] ? rowToBrief(rows[0]) : null;
  } catch { return null; }
}

export async function listSerpBriefs(
  tenantId: string,
  limit = 20,
): Promise<SerpBrief[]> {
  const sql = getPostgresClient();
  if (!sql) return [];
  const lim = Math.min(Math.max(1, limit), 50);
  try {
    const rows = await sql<SerpBriefRow[]>`
      SELECT * FROM serp_briefs
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
      LIMIT ${lim}
    `;
    return rows.map(rowToBrief);
  } catch { return []; }
}
