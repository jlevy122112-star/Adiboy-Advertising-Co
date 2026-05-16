/**
 * Postgres persistence for `brand_memory_sources` + `brand_memory_chunks` (Phase 1).
 */

import { getPostgresClient } from "./postgres.js";

/** pgvector text input format — validates all values are finite before interpolation. */
function vectorLiteral(embedding: readonly number[]): string {
  for (const v of embedding) {
    if (!Number.isFinite(v)) {
      throw new Error(`vectorLiteral: non-finite value ${v} in embedding`);
    }
  }
  return `[${embedding.join(",")}]`;
}

export type UpsertBrandMemoryChunksInput = {
  readonly workspaceId: string;
  readonly brandId: string;
  readonly sourceId: string;
  readonly version: string;
  readonly sourceType: string;
  readonly title: string | null;
  readonly summary: string | null;
  readonly tags: readonly string[];
  readonly trusted: boolean;
  readonly chunks: readonly {
    readonly chunkIndex: number;
    readonly text: string;
    readonly tokenCount: number;
    readonly embedding: readonly number[] | null;
  }[];
};

export type UpsertBrandMemoryResolve =
  | {
      readonly ok: true;
      readonly chunkCount: number;
      readonly embeddedChunkCount: number;
    }
  | {
      readonly ok: false;
      readonly code: "no_database" | "upsert_failed";
      readonly message: string;
    };

export async function upsertBrandMemorySourceTransactional(
  input: UpsertBrandMemoryChunksInput,
): Promise<UpsertBrandMemoryResolve> {
  const sql = getPostgresClient();
  if (!sql) {
    return { ok: false, code: "no_database", message: "DATABASE_URL not set." };
  }
  let embeddedChunkCount = 0;
  try {
    await sql.begin(async (tx) => {
      await tx`
        INSERT INTO brand_memory_sources (
          workspace_id, brand_id, source_id, version,
          source_type, title, summary, tags, trusted, updated_at
        )
        VALUES (
          ${input.workspaceId},
          ${input.brandId},
          ${input.sourceId},
          ${input.version},
          ${input.sourceType},
          ${input.title},
          ${input.summary},
          ${[...input.tags]},
          ${input.trusted},
          now()
        )
        ON CONFLICT (workspace_id, brand_id, source_id, version)
        DO UPDATE SET
          source_type = EXCLUDED.source_type,
          title = EXCLUDED.title,
          summary = EXCLUDED.summary,
          tags = EXCLUDED.tags,
          trusted = EXCLUDED.trusted,
          updated_at = now()
      `;

      await tx`
        DELETE FROM brand_memory_chunks
        WHERE workspace_id = ${input.workspaceId}
          AND brand_id = ${input.brandId}
          AND source_id = ${input.sourceId}
          AND version = ${input.version}
      `;

      for (const c of input.chunks) {
        const emb = c.embedding;
        if (emb !== null) {
          embeddedChunkCount += 1;
          await tx`
            INSERT INTO brand_memory_chunks (
              workspace_id, brand_id, source_id, version,
              chunk_index, text, token_count, embedding, created_at
            )
            VALUES (
              ${input.workspaceId},
              ${input.brandId},
              ${input.sourceId},
              ${input.version},
              ${c.chunkIndex},
              ${c.text},
              ${c.tokenCount},
              ${vectorLiteral(emb)}::vector,
              now()
            )
          `;
        } else {
          await tx`
            INSERT INTO brand_memory_chunks (
              workspace_id, brand_id, source_id, version,
              chunk_index, text, token_count, embedding, created_at
            )
            VALUES (
              ${input.workspaceId},
              ${input.brandId},
              ${input.sourceId},
              ${input.version},
              ${c.chunkIndex},
              ${c.text},
              ${c.tokenCount},
              NULL,
              now()
            )
          `;
        }
      }
    });
    return {
      ok: true,
      chunkCount: input.chunks.length,
      embeddedChunkCount,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "upsert_failed", message };
  }
}

export type BrandMemoryVectorHit = {
  readonly chunkId: string;
  readonly sourceId: string;
  readonly text: string;
  /** Cosine similarity in [0, 1] (1 = identical). */
  readonly similarity: number;
};

export type QueryBrandMemoryResolve =
  | { readonly ok: true; readonly mode: "vector"; readonly hits: BrandMemoryVectorHit[] }
  | { readonly ok: true; readonly mode: "lexical"; readonly hits: BrandMemoryVectorHit[] }
  | { readonly ok: false; readonly code: "no_database" | "query_failed"; readonly message: string };

export async function queryBrandMemoryVector(
  workspaceId: string,
  brandId: string,
  queryEmbedding: readonly number[],
  limit: number,
): Promise<QueryBrandMemoryResolve> {
  const sql = getPostgresClient();
  if (!sql) {
    return { ok: false, code: "no_database", message: "DATABASE_URL not set." };
  }
  const lim = Math.min(Math.max(1, Math.floor(limit)), 50);
  const vec = vectorLiteral(queryEmbedding);
  try {
    const rows = await sql<{ chunk_id: string; source_id: string; text: string; similarity: number }[]>`
      SELECT chunk_id::text AS chunk_id,
             source_id::text AS source_id,
             text,
             1.0 - (embedding <=> ${vec}::vector) AS similarity
      FROM brand_memory_chunks
      WHERE workspace_id = ${workspaceId}
        AND brand_id = ${brandId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${vec}::vector
      LIMIT ${lim}
    `;
    return {
      ok: true,
      mode: "vector",
      hits: rows.map((r) => ({
        chunkId: r.chunk_id,
        sourceId: r.source_id,
        text: r.text,
        similarity: Number(r.similarity),
      })),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "query_failed", message };
  }
}

export async function queryBrandMemoryLexicalRecent(
  workspaceId: string,
  brandId: string,
  limit: number,
): Promise<QueryBrandMemoryResolve> {
  const sql = getPostgresClient();
  if (!sql) {
    return { ok: false, code: "no_database", message: "DATABASE_URL not set." };
  }
  const lim = Math.min(Math.max(1, Math.floor(limit)), 50);
  try {
    const rows = await sql<{ chunk_id: string; source_id: string; text: string }[]>`
      SELECT chunk_id::text AS chunk_id, source_id::text AS source_id, text
      FROM brand_memory_chunks
      WHERE workspace_id = ${workspaceId}
        AND brand_id = ${brandId}
      ORDER BY created_at DESC
      LIMIT ${lim}
    `;
    return {
      ok: true,
      mode: "lexical",
      hits: rows.map((r) => ({ chunkId: r.chunk_id, sourceId: r.source_id, text: r.text, similarity: 0 })),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: "query_failed", message };
  }
}
