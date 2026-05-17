import { getPostgresClient } from "./postgres.js";
import { createHash, randomBytes } from "node:crypto";

export type ViralShareRow = {
  id: string;
  tenant_id: string;
  campaign_id: string | null;
  post_id: string | null;
  template_id: string | null;
  report_id: string | null;
  share_type: string;
  channel: string;
  share_token: string;
  shared_by: string;
  view_count: number;
  signup_count: number;
  branding_visible: boolean;
  created_at: string;
};

export type ViralSignupRow = {
  id: string;
  share_token: string;
  referee_id: string | null;
  ip_hash: string | null;
  created_at: string;
};

export type TemplateCloneRow = {
  id: string;
  template_id: string;
  cloned_by: string;
  tenant_id: string;
  source_token: string | null;
  created_at: string;
};

export function generateShareToken(): string {
  return randomBytes(12).toString("base64url");
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

export async function insertViralShare(input: {
  tenantId: string;
  shareType: string;
  channel: string;
  sharedBy: string;
  campaignId?: string;
  postId?: string;
  templateId?: string;
  reportId?: string;
  brandingVisible?: boolean;
}): Promise<ViralShareRow | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  const token = generateShareToken();
  const rows = await sql<ViralShareRow[]>`
    INSERT INTO viral_shares
      (tenant_id, campaign_id, post_id, template_id, report_id, share_type, channel, share_token, shared_by, branding_visible)
    VALUES (
      ${input.tenantId}, ${input.campaignId ?? null}, ${input.postId ?? null},
      ${input.templateId ?? null}, ${input.reportId ?? null},
      ${input.shareType}, ${input.channel}, ${token}, ${input.sharedBy},
      ${input.brandingVisible ?? true}
    )
    RETURNING *
  `;
  return rows[0] ?? null;
}

export async function getViralShare(shareToken: string): Promise<ViralShareRow | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  const rows = await sql<ViralShareRow[]>`
    SELECT * FROM viral_shares WHERE share_token = ${shareToken} LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function incrementShareView(shareToken: string): Promise<void> {
  const sql = getPostgresClient();
  if (!sql) return;
  await sql`UPDATE viral_shares SET view_count = view_count + 1 WHERE share_token = ${shareToken}`;
}

export async function recordViralSignup(input: {
  shareToken: string;
  refereeId?: string;
  ip?: string;
}): Promise<boolean> {
  const sql = getPostgresClient();
  if (!sql) return false;
  const ipHash = input.ip ? hashIp(input.ip) : null;

  // Dedup: one signup per IP per share
  if (ipHash) {
    const existing = await sql`
      SELECT id FROM viral_signups WHERE share_token = ${input.shareToken} AND ip_hash = ${ipHash} LIMIT 1
    `;
    if (existing.length > 0) return false;
  }

  await sql`
    INSERT INTO viral_signups (share_token, referee_id, ip_hash)
    VALUES (${input.shareToken}, ${input.refereeId ?? null}, ${ipHash})
  `;
  await sql`UPDATE viral_shares SET signup_count = signup_count + 1 WHERE share_token = ${input.shareToken}`;
  return true;
}

export async function recordTemplateClone(input: {
  templateId: string;
  clonedBy: string;
  tenantId: string;
  sourceToken?: string;
}): Promise<TemplateCloneRow | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  const rows = await sql<TemplateCloneRow[]>`
    INSERT INTO template_clones (template_id, cloned_by, tenant_id, source_token)
    VALUES (${input.templateId}, ${input.clonedBy}, ${input.tenantId}, ${input.sourceToken ?? null})
    RETURNING *
  `;
  return rows[0] ?? null;
}

export async function getViralMetrics(tenantId: string, windowDays = 30): Promise<{
  totalShares: number;
  totalViews: number;
  totalSignups: number;
  totalClones: number;
  topShares: ViralShareRow[];
  viralCoefficient: number;
}> {
  const sql = getPostgresClient();
  if (!sql) return { totalShares: 0, totalViews: 0, totalSignups: 0, totalClones: 0, topShares: [], viralCoefficient: 0 };

  const since = new Date(Date.now() - windowDays * 86400_000).toISOString();

  const [agg, top, clones] = await Promise.all([
    sql<{ total_shares: string; total_views: string; total_signups: string }[]>`
      SELECT COUNT(*)::text AS total_shares, COALESCE(SUM(view_count),0)::text AS total_views,
             COALESCE(SUM(signup_count),0)::text AS total_signups
      FROM viral_shares WHERE tenant_id = ${tenantId} AND created_at >= ${since}
    `,
    sql<ViralShareRow[]>`
      SELECT * FROM viral_shares WHERE tenant_id = ${tenantId} AND created_at >= ${since}
      ORDER BY signup_count DESC LIMIT 10
    `,
    sql<{ cnt: string }[]>`
      SELECT COUNT(*)::text AS cnt FROM template_clones WHERE tenant_id = ${tenantId} AND created_at >= ${since}
    `,
  ]);

  const row = agg[0];
  const totalShares = Number(row?.total_shares ?? 0);
  const totalViews = Number(row?.total_views ?? 0);
  const totalSignups = Number(row?.total_signups ?? 0);
  const totalClones = Number(clones[0]?.cnt ?? 0);
  const viralCoefficient = totalShares > 0 ? Math.round((totalSignups / totalShares) * 100) / 100 : 0;

  return { totalShares, totalViews, totalSignups, totalClones, topShares: top, viralCoefficient };
}
