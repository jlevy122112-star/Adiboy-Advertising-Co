/**
 * Phase 1 — brand memory retrieval for generation context.
 *
 * - Lexical overlap over trusted knowledge source title / summary / tags (no network).
 * - Optional embedding cosine ranking when the caller supplies vectors (e.g. from an
 *   external embedder in Phase 2+); this module stays pure — no I/O.
 */

import type { BrandIntelligenceProfile } from "./brand-intelligence.js";
import type { BrandKnowledgeSource } from "./brand-intelligence.js";
import type { BrandRetrievalSnippet } from "./brand-intelligence.js";
import { BrandRetrievalSnippetSchema } from "./brand-intelligence.js";
import {
  BRAND_MEMORY_EMBEDDING_DIMENSION,
  parseBrandMemoryEmbedding1536,
  type BrandMemoryEmbedding1536,
} from "./brand-memory-embedding.js";

/** Lowercase tokens for simple overlap scoring (ASCII-ish words + digits). */
export function tokenizeRetrievalText(text: string): string[] {
  const lower = text.toLowerCase();
  const parts = lower.split(/[^a-z0-9]+/i);
  const out: string[] = [];
  for (const p of parts) {
    const t = p.trim();
    if (t.length >= 2) {
      out.push(t);
    }
  }
  return out;
}

function corpusForSource(source: BrandKnowledgeSource): string {
  const tagPart = source.tags.length > 0 ? source.tags.join(" ") : "";
  const summary = source.summary?.trim() ?? "";
  return [source.title, summary, tagPart].filter(Boolean).join("\n");
}

function clipExcerpt(text: string, maxLen: number): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1).trimEnd()}…`;
}

export interface LexicalRetrievalFromProfileOptions {
  /** When true (default), only sources with `trusted: true` participate. */
  readonly trustedOnly?: boolean;
  readonly limit?: number;
}

/**
 * Deterministic lexical overlap between `queryText` and each knowledge source's
 * title, summary, and tags. Produces {@link BrandRetrievalSnippet} rows for
 * `buildBrandGenerationContext({ retrievalSnippets })`.
 */
export function lexicalRetrievalSnippetsFromProfile(
  profile: BrandIntelligenceProfile,
  queryText: string,
  options: LexicalRetrievalFromProfileOptions = {},
): BrandRetrievalSnippet[] {
  const q = queryText.trim();
  if (!q) return [];

  const queryTokens = [...new Set(tokenizeRetrievalText(q))];
  if (queryTokens.length === 0) return [];

  const trustedOnly = options.trustedOnly ?? true;
  const limit = Math.min(20, Math.max(1, options.limit ?? 8));

  const candidates = profile.knowledgeSources.filter((s) =>
    trustedOnly ? s.trusted : true,
  );

  const scored: { source: BrandKnowledgeSource; score: number }[] = [];

  for (const source of candidates) {
    const corpus = corpusForSource(source);
    const corpusTokens = new Set(tokenizeRetrievalText(corpus));
    let hits = 0;
    for (const qt of queryTokens) {
      if (corpusTokens.has(qt)) {
        hits += 1;
        continue;
      }
      if (corpus.includes(qt)) {
        hits += 0.5;
      }
    }
    if (hits <= 0) continue;
    const score = Math.min(1, hits / queryTokens.length);
    scored.push({ source, score });
  }

  scored.sort((a, b) => b.score - a.score || a.source.sourceId.localeCompare(b.source.sourceId));

  const snippets: BrandRetrievalSnippet[] = [];
  let i = 0;
  for (const { source, score } of scored) {
    if (snippets.length >= limit) break;
    const excerptBase =
      source.summary?.trim() || corpusForSource(source) || source.title;
    const snippetId = (`lex:${i}:${source.sourceId}`).slice(0, 120);
    i += 1;
    const parsed = BrandRetrievalSnippetSchema.safeParse({
      snippetId,
      sourceId: source.sourceId,
      citationLabel: clipExcerpt(source.title, 160),
      textExcerpt: clipExcerpt(excerptBase, 4_000),
      score,
      metadata: { kind: source.kind },
    });
    if (parsed.success) {
      snippets.push(parsed.data);
    }
  }

  return snippets;
}

export interface EmbeddingRetrievalCandidate {
  readonly sourceId: string;
  readonly citationLabel: string;
  readonly textExcerpt: string;
  /** Must be exactly {@link BRAND_MEMORY_EMBEDDING_DIMENSION} when present for ranking. */
  readonly embedding: BrandMemoryEmbedding1536;
}

/** Cosine similarity in [-1, 1]; returns 0 when undefined or length mismatch. */
export function cosineSimilarityEmbedding(
  a: readonly number[],
  b: readonly number[],
): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export interface RankBrandSnippetsByEmbeddingArgs {
  readonly queryEmbedding: readonly number[];
  readonly candidates: readonly EmbeddingRetrievalCandidate[];
  readonly limit?: number;
}

export type RankBrandSnippetsByEmbeddingResult =
  | { readonly ok: true; readonly snippets: BrandRetrievalSnippet[] }
  | {
      readonly ok: false;
      readonly code: "query_embedding_dim";
      readonly message: string;
    };

/**
 * Rank pre-embedded text chunks by cosine similarity to `queryEmbedding`.
 * **Query embedding must be exactly 1536 dimensions** — otherwise returns
 * `{ ok: false, code: 'query_embedding_dim' }` (map to HTTP 400 in API).
 * Candidates must already satisfy {@link BrandMemoryEmbedding1536}; invalid rows
 * are skipped (ingest should have rejected them).
 *
 * Maps cosine from [-1,1] to snippet score [0,1] via `(cos + 1) / 2`.
 */
export function rankBrandSnippetsByEmbedding(
  args: RankBrandSnippetsByEmbeddingArgs,
): RankBrandSnippetsByEmbeddingResult {
  const qParsed = parseBrandMemoryEmbedding1536(args.queryEmbedding);
  if (!qParsed.ok) {
    return {
      ok: false,
      code: "query_embedding_dim",
      message: qParsed.message,
    };
  }
  const q = qParsed.embedding;

  const limit = Math.min(20, Math.max(1, args.limit ?? 8));

  const scored: { c: EmbeddingRetrievalCandidate; cos: number }[] = [];
  for (const c of args.candidates) {
    const cParsed = parseBrandMemoryEmbedding1536(c.embedding);
    if (!cParsed.ok) {
      continue;
    }
    const cos = cosineSimilarityEmbedding(q, cParsed.embedding);
    scored.push({ c, cos });
  }
  scored.sort(
    (a, b) => b.cos - a.cos || a.c.sourceId.localeCompare(b.c.sourceId),
  );

  const snippets: BrandRetrievalSnippet[] = [];
  let i = 0;
  for (const { c, cos } of scored) {
    if (snippets.length >= limit) break;
    const score = Math.min(1, Math.max(0, (cos + 1) / 2));
    const snippetId = (`emb:${i}:${c.sourceId}`).slice(0, 120);
    i += 1;
    const parsed = BrandRetrievalSnippetSchema.safeParse({
      snippetId,
      sourceId: c.sourceId,
      citationLabel: clipExcerpt(c.citationLabel, 160),
      textExcerpt: clipExcerpt(c.textExcerpt, 4_000),
      score,
    });
    if (parsed.success) {
      snippets.push(parsed.data);
    }
  }
  return { ok: true, snippets };
}
