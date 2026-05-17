import { getPostgresClient } from "./postgres.js";
import type { SocialComment, SentimentSummary } from "@home-link/marketer-pro-contract";

interface CommentRow {
  id: string; tenant_id: string; schedule_entry_id: string; network: string;
  external_comment_id: string; author_name: string | null; author_id: string | null;
  body: string; like_count: string | null; reply_count: string | null;
  posted_at: Date | null; sentiment_score: string | null;
  sentiment_confidence: number | null; topics: string[];
  is_negative_signal: boolean; brand_safety_flags: string[];
  suggested_response: string | null; fed_to_memory: boolean;
  created_at: Date; updated_at: Date;
}

function rowToComment(r: CommentRow): SocialComment {
  return {
    id: r.id, tenantId: r.tenant_id, scheduleEntryId: r.schedule_entry_id,
    network: r.network, externalCommentId: r.external_comment_id,
    authorName: r.author_name ?? undefined, authorId: r.author_id ?? undefined,
    body: r.body,
    likeCount:  r.like_count  != null ? Number(r.like_count)  : null,
    replyCount: r.reply_count != null ? Number(r.reply_count) : null,
    postedAt: r.posted_at?.toISOString() ?? null,
    sentimentScore: (r.sentiment_score as SocialComment["sentimentScore"]) ?? null,
    sentimentConfidence: r.sentiment_confidence,
    topics: r.topics,
    isNegativeSignal: r.is_negative_signal,
    brandSafetyFlags: r.brand_safety_flags as SocialComment["brandSafetyFlags"],
    suggestedResponse: r.suggested_response,
    fedToMemory: r.fed_to_memory,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export interface UpsertCommentInput {
  id: string; tenantId: string; scheduleEntryId: string; network: string;
  externalCommentId: string; authorName?: string; authorId?: string; body: string;
  likeCount?: number | null; replyCount?: number | null; postedAt?: string | null;
  sentimentScore?: string | null; sentimentConfidence?: number | null;
  topics?: string[]; isNegativeSignal?: boolean; brandSafetyFlags?: string[];
  suggestedResponse?: string | null; fedToMemory?: boolean;
}

export async function upsertSocialComment(c: UpsertCommentInput): Promise<SocialComment | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  try {
    const rows = await sql<CommentRow[]>`
      INSERT INTO social_comments (
        id, tenant_id, schedule_entry_id, network, external_comment_id,
        author_name, author_id, body, like_count, reply_count, posted_at,
        sentiment_score, sentiment_confidence, topics, is_negative_signal,
        brand_safety_flags, suggested_response, fed_to_memory, updated_at
      ) VALUES (
        ${c.id}, ${c.tenantId}, ${c.scheduleEntryId}, ${c.network}, ${c.externalCommentId},
        ${c.authorName ?? null}, ${c.authorId ?? null}, ${c.body},
        ${c.likeCount ?? null}, ${c.replyCount ?? null},
        ${c.postedAt ? new Date(c.postedAt) : null},
        ${c.sentimentScore ?? null}, ${c.sentimentConfidence ?? null},
        ${c.topics ?? []}, ${c.isNegativeSignal ?? false},
        ${c.brandSafetyFlags ?? []}, ${c.suggestedResponse ?? null},
        ${c.fedToMemory ?? false}, NOW()
      )
      ON CONFLICT (tenant_id, network, external_comment_id) DO UPDATE SET
        body                 = EXCLUDED.body,
        like_count           = EXCLUDED.like_count,
        reply_count          = EXCLUDED.reply_count,
        sentiment_score      = EXCLUDED.sentiment_score,
        sentiment_confidence = EXCLUDED.sentiment_confidence,
        topics               = EXCLUDED.topics,
        is_negative_signal   = EXCLUDED.is_negative_signal,
        brand_safety_flags   = EXCLUDED.brand_safety_flags,
        suggested_response   = EXCLUDED.suggested_response,
        fed_to_memory        = EXCLUDED.fed_to_memory,
        updated_at           = NOW()
      RETURNING *
    `;
    return rows[0] ? rowToComment(rows[0]) : null;
  } catch { return null; }
}

export async function markFedToMemory(id: string): Promise<void> {
  const sql = getPostgresClient();
  if (!sql) return;
  try { await sql`UPDATE social_comments SET fed_to_memory = TRUE, updated_at = NOW() WHERE id = ${id}`; }
  catch { /* best-effort */ }
}

export interface ListCommentsFilter {
  tenantId: string; scheduleEntryId?: string; network?: string;
  sentimentScore?: string; negativeOnly?: boolean; brandSafetyOnly?: boolean; limit?: number;
}

export async function listSocialComments(f: ListCommentsFilter): Promise<SocialComment[]> {
  const sql = getPostgresClient();
  if (!sql) return [];
  const limit = Math.min(f.limit ?? 50, 200);
  try {
    // Branch to avoid dynamic sql fragments
    if (f.scheduleEntryId && f.negativeOnly) {
      return (await sql<CommentRow[]>`
        SELECT * FROM social_comments WHERE tenant_id=${f.tenantId}
        AND schedule_entry_id=${f.scheduleEntryId} AND is_negative_signal=TRUE
        ORDER BY posted_at DESC NULLS LAST, created_at DESC LIMIT ${limit}
      `).map(rowToComment);
    }
    if (f.scheduleEntryId && f.brandSafetyOnly) {
      return (await sql<CommentRow[]>`
        SELECT * FROM social_comments WHERE tenant_id=${f.tenantId}
        AND schedule_entry_id=${f.scheduleEntryId} AND array_length(brand_safety_flags,1)>0
        ORDER BY posted_at DESC NULLS LAST, created_at DESC LIMIT ${limit}
      `).map(rowToComment);
    }
    if (f.scheduleEntryId && f.sentimentScore) {
      return (await sql<CommentRow[]>`
        SELECT * FROM social_comments WHERE tenant_id=${f.tenantId}
        AND schedule_entry_id=${f.scheduleEntryId} AND sentiment_score=${f.sentimentScore}
        ORDER BY posted_at DESC NULLS LAST, created_at DESC LIMIT ${limit}
      `).map(rowToComment);
    }
    if (f.scheduleEntryId) {
      return (await sql<CommentRow[]>`
        SELECT * FROM social_comments WHERE tenant_id=${f.tenantId}
        AND schedule_entry_id=${f.scheduleEntryId}
        ORDER BY posted_at DESC NULLS LAST, created_at DESC LIMIT ${limit}
      `).map(rowToComment);
    }
    if (f.negativeOnly) {
      return (await sql<CommentRow[]>`
        SELECT * FROM social_comments WHERE tenant_id=${f.tenantId} AND is_negative_signal=TRUE
        ORDER BY posted_at DESC NULLS LAST, created_at DESC LIMIT ${limit}
      `).map(rowToComment);
    }
    if (f.brandSafetyOnly) {
      return (await sql<CommentRow[]>`
        SELECT * FROM social_comments WHERE tenant_id=${f.tenantId}
        AND array_length(brand_safety_flags,1)>0
        ORDER BY posted_at DESC NULLS LAST, created_at DESC LIMIT ${limit}
      `).map(rowToComment);
    }
    if (f.sentimentScore) {
      return (await sql<CommentRow[]>`
        SELECT * FROM social_comments WHERE tenant_id=${f.tenantId}
        AND sentiment_score=${f.sentimentScore}
        ORDER BY posted_at DESC NULLS LAST, created_at DESC LIMIT ${limit}
      `).map(rowToComment);
    }
    if (f.network) {
      return (await sql<CommentRow[]>`
        SELECT * FROM social_comments WHERE tenant_id=${f.tenantId} AND network=${f.network}
        ORDER BY posted_at DESC NULLS LAST, created_at DESC LIMIT ${limit}
      `).map(rowToComment);
    }
    return (await sql<CommentRow[]>`
      SELECT * FROM social_comments WHERE tenant_id=${f.tenantId}
      ORDER BY posted_at DESC NULLS LAST, created_at DESC LIMIT ${limit}
    `).map(rowToComment);
  } catch { return []; }
}

export async function getSentimentSummary(
  tenantId: string,
  scheduleEntryId?: string,
  network?: string,
): Promise<SentimentSummary> {
  const empty: SentimentSummary = {
    tenantId, scheduleEntryId: scheduleEntryId ?? null, network: network ?? null,
    totalComments: 0, positiveCount: 0, negativeCount: 0, neutralCount: 0, mixedCount: 0,
    negativeSignalCount: 0, brandSafetyFlagCount: 0, avgConfidence: 0,
    topTopics: [], overallSentiment: null,
  };
  const sql = getPostgresClient();
  if (!sql) return empty;

  try {
    type AggRow = { total: string; positive: string; negative: string; neutral: string;
      mixed: string; neg_signal: string; safety_flags: string; avg_conf: string | null };
    type TopicRow = { topic: string; cnt: string };

    let aggRows: AggRow[];
    let topicRows: TopicRow[];

    if (scheduleEntryId) {
      aggRows = await sql<AggRow[]>`
        SELECT COUNT(*) AS total,
          COUNT(*) FILTER (WHERE sentiment_score='positive') AS positive,
          COUNT(*) FILTER (WHERE sentiment_score='negative') AS negative,
          COUNT(*) FILTER (WHERE sentiment_score='neutral')  AS neutral,
          COUNT(*) FILTER (WHERE sentiment_score='mixed')    AS mixed,
          COUNT(*) FILTER (WHERE is_negative_signal=TRUE)    AS neg_signal,
          COUNT(*) FILTER (WHERE array_length(brand_safety_flags,1)>0) AS safety_flags,
          AVG(sentiment_confidence) AS avg_conf
        FROM social_comments WHERE tenant_id=${tenantId} AND schedule_entry_id=${scheduleEntryId}`;
      topicRows = await sql<TopicRow[]>`
        SELECT unnest(topics) AS topic, COUNT(*) AS cnt
        FROM social_comments WHERE tenant_id=${tenantId} AND schedule_entry_id=${scheduleEntryId}
        GROUP BY topic ORDER BY cnt DESC LIMIT 10`;
    } else if (network) {
      aggRows = await sql<AggRow[]>`
        SELECT COUNT(*) AS total,
          COUNT(*) FILTER (WHERE sentiment_score='positive') AS positive,
          COUNT(*) FILTER (WHERE sentiment_score='negative') AS negative,
          COUNT(*) FILTER (WHERE sentiment_score='neutral')  AS neutral,
          COUNT(*) FILTER (WHERE sentiment_score='mixed')    AS mixed,
          COUNT(*) FILTER (WHERE is_negative_signal=TRUE)    AS neg_signal,
          COUNT(*) FILTER (WHERE array_length(brand_safety_flags,1)>0) AS safety_flags,
          AVG(sentiment_confidence) AS avg_conf
        FROM social_comments WHERE tenant_id=${tenantId} AND network=${network}`;
      topicRows = await sql<TopicRow[]>`
        SELECT unnest(topics) AS topic, COUNT(*) AS cnt
        FROM social_comments WHERE tenant_id=${tenantId} AND network=${network}
        GROUP BY topic ORDER BY cnt DESC LIMIT 10`;
    } else {
      aggRows = await sql<AggRow[]>`
        SELECT COUNT(*) AS total,
          COUNT(*) FILTER (WHERE sentiment_score='positive') AS positive,
          COUNT(*) FILTER (WHERE sentiment_score='negative') AS negative,
          COUNT(*) FILTER (WHERE sentiment_score='neutral')  AS neutral,
          COUNT(*) FILTER (WHERE sentiment_score='mixed')    AS mixed,
          COUNT(*) FILTER (WHERE is_negative_signal=TRUE)    AS neg_signal,
          COUNT(*) FILTER (WHERE array_length(brand_safety_flags,1)>0) AS safety_flags,
          AVG(sentiment_confidence) AS avg_conf
        FROM social_comments WHERE tenant_id=${tenantId}`;
      topicRows = await sql<TopicRow[]>`
        SELECT unnest(topics) AS topic, COUNT(*) AS cnt
        FROM social_comments WHERE tenant_id=${tenantId}
        GROUP BY topic ORDER BY cnt DESC LIMIT 10`;
    }

    const r = aggRows[0]!;
    const total    = Number(r.total);
    const positive = Number(r.positive);
    const negative = Number(r.negative);
    const neutral  = Number(r.neutral);
    const mixed    = Number(r.mixed);

    let overall: SentimentSummary["overallSentiment"] = null;
    if (total > 0) {
      const entries = [["positive",positive],["negative",negative],["neutral",neutral],["mixed",mixed]] as [string,number][];
      overall = entries.sort(([,a],[,b]) => b - a)[0]![0] as SentimentSummary["overallSentiment"];
    }

    return {
      tenantId, scheduleEntryId: scheduleEntryId ?? null, network: network ?? null,
      totalComments: total, positiveCount: positive, negativeCount: negative,
      neutralCount: neutral, mixedCount: mixed,
      negativeSignalCount: Number(r.neg_signal),
      brandSafetyFlagCount: Number(r.safety_flags),
      avgConfidence: r.avg_conf != null ? Number(r.avg_conf) : 0,
      topTopics: topicRows.map(t => ({ topic: t.topic, count: Number(t.cnt) })),
      overallSentiment: overall,
    };
  } catch { return empty; }
}
