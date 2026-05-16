/**
 * HTTP-facing brand memory routes (Phase 1) — validate, chunk, delegate to Postgres.
 */

import {
  BrandMemoryChunkingConfigSchema,
  BrandMemoryQueryBodySchema,
  UpsertBrandMemorySourceBodySchema,
} from "@home-link/marketer-pro-contract";

import {
  queryBrandMemoryLexicalRecent,
  queryBrandMemoryVector,
  upsertBrandMemorySourceTransactional,
} from "../db/brand-memory.js";
import { chunkTextByTokenWords } from "./chunk-text.js";

export type BrandMemoryHttpSuccess<T> = {
  readonly ok: true;
  readonly status: number;
  readonly body: T;
};

export type BrandMemoryHttpError = {
  readonly ok: false;
  readonly status: number;
  readonly body: unknown;
};

export type BrandMemoryHttpOutcome =
  | BrandMemoryHttpSuccess<unknown>
  | BrandMemoryHttpError;

export async function executeUpsertBrandMemorySourceRequest(
  body: unknown,
): Promise<BrandMemoryHttpOutcome> {
  const parsed = UpsertBrandMemorySourceBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: { error: "validation_error", message: parsed.error.message },
    };
  }
  const b = parsed.data;

  const chunking = BrandMemoryChunkingConfigSchema.parse({
    strategy: "by_tokens",
    maxTokens: b.chunking?.maxTokens ?? 350,
    overlapTokens: b.chunking?.overlapTokens ?? 60,
  });

  const textChunks = chunkTextByTokenWords(b.text, {
    maxTokens: chunking.maxTokens,
    overlapTokens: chunking.overlapTokens,
  });

  const vectorByIndex = new Map<number, readonly number[]>();
  if (b.embedding) {
    for (const row of b.embedding.chunks) {
      vectorByIndex.set(row.chunkIndex, row.vector);
    }
    for (const idx of vectorByIndex.keys()) {
      if (idx < 0 || idx >= textChunks.length) {
        return {
          ok: false,
          status: 400,
          body: {
            error: "embedding_chunk_index_out_of_range",
            message: `chunkIndex ${idx} has no text chunk (chunk count ${textChunks.length})`,
            chunkIndex: idx,
          },
        };
      }
    }
  }

  const chunks = textChunks.map((c) => ({
    chunkIndex: c.chunkIndex,
    text: c.text,
    tokenCount: c.tokenCount,
    embedding: (vectorByIndex.get(c.chunkIndex) as readonly number[] | undefined) ?? null,
  }));

  const db = await upsertBrandMemorySourceTransactional({
    workspaceId: b.workspaceId,
    brandId: b.brandId,
    sourceId: b.sourceId,
    version: b.version,
    sourceType: b.sourceType,
    title: b.title ?? null,
    summary: b.summary ?? null,
    tags: b.tags ?? [],
    trusted: b.trusted ?? false,
    chunks,
  });

  if (!db.ok) {
    if (db.code === "no_database") {
      return {
        ok: false,
        status: 503,
        body: { error: "database_required", message: db.message },
      };
    }
    return {
      ok: false,
      status: 500,
      body: { error: "upsert_failed", message: db.message },
    };
  }

  return {
    ok: true,
    status: 200,
    body: {
      workspaceId: b.workspaceId,
      brandId: b.brandId,
      sourceId: b.sourceId,
      version: b.version,
      chunkCount: db.chunkCount,
      embeddedChunkCount: db.embeddedChunkCount,
    },
  };
}

export async function executeBrandMemoryQueryRequest(
  body: unknown,
): Promise<BrandMemoryHttpOutcome> {
  const parsed = BrandMemoryQueryBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: { error: "validation_error", message: parsed.error.message },
    };
  }
  const { workspaceId, brandId, queryEmbedding, limit } = parsed.data;

  if (queryEmbedding !== undefined) {
    const r = await queryBrandMemoryVector(workspaceId, brandId, queryEmbedding, limit);
    if (!r.ok) {
      if (r.code === "no_database") {
        return {
          ok: false,
          status: 503,
          body: { error: "database_required", message: r.message },
        };
      }
      return {
        ok: false,
        status: 500,
        body: { error: "query_failed", message: r.message },
      };
    }
    return { ok: true, status: 200, body: { mode: r.mode, hits: r.hits } };
  }

  const r = await queryBrandMemoryLexicalRecent(workspaceId, brandId, limit);
  if (!r.ok) {
    if (r.code === "no_database") {
      return {
        ok: false,
        status: 503,
        body: { error: "database_required", message: r.message },
      };
    }
    return {
      ok: false,
      status: 500,
      body: { error: "query_failed", message: r.message },
    };
  }
  return { ok: true, status: 200, body: { mode: r.mode, hits: r.hits } };
}
