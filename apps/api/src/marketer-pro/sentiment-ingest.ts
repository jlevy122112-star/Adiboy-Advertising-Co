import { randomUUID } from "node:crypto";
import { getScheduleEntry } from "../db/schedule-entry.js";
import { upsertSocialComment, markFedToMemory, listSocialComments } from "../db/social-comment.js";
import { analyzeCommentSentiment } from "../sentiment/sentiment-provider.js";
import { fetchMetaComments } from "../sentiment/meta-comments.js";
import { fetchXComments } from "../sentiment/x-comments.js";
import { fetchLinkedInComments } from "../sentiment/linkedin-comments.js";
import { fetchYouTubeComments } from "../sentiment/youtube-comments.js";
import { getPostgresClient } from "../db/postgres.js";
import type { RawComment } from "../sentiment/meta-comments.js";

type IngestResult = { ok: true; ingested: number; analyzed: number } | { ok: false; error: string };

async function fetchComments(network: string, externalId: string): Promise<RawComment[]> {
  if (network === "facebook" || network === "instagram") return fetchMetaComments(externalId);
  if (network === "x")         return fetchXComments(externalId);
  if (network === "linkedin")  return fetchLinkedInComments(externalId);
  if (network === "youtube")   return fetchYouTubeComments(externalId);
  return [];
}

export async function ingestSentimentForEntry(
  tenantId: string,
  scheduleEntryId: string,
): Promise<IngestResult> {
  const entry = await getScheduleEntry(tenantId, scheduleEntryId);
  if (!entry) return { ok: false, error: "schedule_entry_not_found" };
  if (!entry.external_id) return { ok: false, error: "not_yet_published" };

  const raw = await fetchComments(entry.network ?? "", entry.external_id);

  let analyzed = 0;
  for (const c of raw) {
    if (!c.body.trim()) continue;

    const analysis = await analyzeCommentSentiment(c.body);

    await upsertSocialComment({
      id: randomUUID(),
      tenantId,
      scheduleEntryId,
      network: entry.network ?? "generic",
      externalCommentId: c.externalCommentId,
      authorName: c.authorName,
      authorId: c.authorId,
      body: c.body,
      likeCount: c.likeCount,
      replyCount: c.replyCount,
      postedAt: c.postedAt,
      sentimentScore: analysis.score,
      sentimentConfidence: analysis.confidence,
      topics: analysis.topics,
      isNegativeSignal: analysis.isNegativeSignal,
      brandSafetyFlags: analysis.brandSafetyFlags,
      suggestedResponse: analysis.suggestedResponse,
    });
    analyzed++;
  }

  // Feed high-signal comments to brand memory
  await feedHighSignalToMemory(tenantId, scheduleEntryId);

  return { ok: true, ingested: raw.length, analyzed };
}

async function feedHighSignalToMemory(tenantId: string, scheduleEntryId: string): Promise<void> {
  const comments = await listSocialComments({
    tenantId,
    scheduleEntryId,
    negativeOnly: false,
    limit: 100,
  });

  const highSignal = comments.filter(
    c => !c.fedToMemory && (c.isNegativeSignal || c.brandSafetyFlags.length > 0 || c.sentimentScore === "positive")
  );

  if (!highSignal.length) return;

  const chunks = highSignal.map(c => ({
    sourceId: `comment:${c.id}`,
    sourceType: "social_comment" as const,
    content: `[${c.network}] ${c.sentimentScore?.toUpperCase()} comment on post ${c.scheduleEntryId}: "${c.body.slice(0, 300)}"`,
    metadata: {
      sentimentScore: c.sentimentScore,
      topics: c.topics,
      isNegativeSignal: c.isNegativeSignal,
      brandSafetyFlags: c.brandSafetyFlags,
    },
  }));

  try {
    const sql = getPostgresClient();
    if (sql) {
      for (const chunk of chunks) {
        await sql`
          INSERT INTO brand_memory_chunks (
            workspace_id, brand_id, source_id, chunk_index, text, token_count, embedding
          ) VALUES (
            ${tenantId}, ${tenantId}, ${chunk.sourceId}, 0,
            ${chunk.content}, ${Math.ceil(chunk.content.length / 4)}, NULL
          )
          ON CONFLICT DO NOTHING
        `;
      }
    }
    for (const c of highSignal) await markFedToMemory(c.id);
  } catch {
    // brand memory is best-effort
  }
}
