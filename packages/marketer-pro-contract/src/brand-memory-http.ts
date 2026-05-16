/**
 * HTTP JSON contracts for brand memory ingest + vector query (Phase 1).
 *
 * Paths mirror `apps/api/src/brand-memory-server.ts` defaults.
 * Embeddings: caller-supplied only; `dims` must be 1536 when an embedding block is present.
 */

import { z } from "zod";

import {
  BRAND_MEMORY_EMBEDDING_DIMENSION,
  parseBrandMemoryEmbedding1536,
} from "./brand-memory-embedding.js";

export const DEFAULT_BRAND_MEMORY_HTTP_PATH_UPSERT =
  "/api/marketer-pro/brand-memory/sources/upsert" as const;
export const DEFAULT_BRAND_MEMORY_HTTP_PATH_QUERY =
  "/api/marketer-pro/brand-memory/query" as const;

export const BrandMemoryChunkingConfigSchema = z
  .object({
    strategy: z.literal("by_tokens"),
    maxTokens: z.number().int().min(16).max(4096).default(350),
    overlapTokens: z.number().int().min(0).max(1024).default(60),
  })
  .strict();

export type BrandMemoryChunkingConfig = z.infer<
  typeof BrandMemoryChunkingConfigSchema
>;

const EmbeddingChunkRowSchema = z
  .object({
    chunkIndex: z.number().int().min(0),
    vector: z.array(z.number()),
  })
  .strict();

/** Caller-supplied per-chunk vectors; each `vector` must be length 1536. */
export const BrandMemoryEmbeddingBlockSchema = z
  .object({
    dims: z.literal(BRAND_MEMORY_EMBEDDING_DIMENSION),
    chunks: z.array(EmbeddingChunkRowSchema),
  })
  .strict()
  .superRefine((data, ctx) => {
    for (let i = 0; i < data.chunks.length; i += 1) {
      const row = data.chunks[i]!;
      const parsed = parseBrandMemoryEmbedding1536(row.vector);
      if (!parsed.ok) {
        ctx.addIssue({
          code: "custom",
          message: `${parsed.message} (embedding.chunks[${i}].vector)`,
          path: ["chunks", i, "vector"],
        });
      }
    }
  });

export type BrandMemoryEmbeddingBlock = z.infer<
  typeof BrandMemoryEmbeddingBlockSchema
>;

/** POST — upsert one logical source + replace all chunks for `(workspaceId, brandId, sourceId, version)`. */
export const UpsertBrandMemorySourceBodySchema = z
  .object({
    workspaceId: z.string().min(1).max(200),
    brandId: z.string().min(1).max(200),
    sourceId: z.string().min(1).max(200),
    version: z.string().min(1).max(200),
    sourceType: z.string().min(1).max(120),
    title: z.string().max(2000).optional(),
    summary: z.string().max(8000).optional(),
    tags: z.array(z.string().min(1).max(120)).max(100).optional(),
    trusted: z.boolean().optional(),
    text: z.string().min(1).max(2_000_000),
    chunking: BrandMemoryChunkingConfigSchema.optional(),
    embedding: BrandMemoryEmbeddingBlockSchema.optional(),
  })
  .strict();

export type UpsertBrandMemorySourceBody = z.infer<
  typeof UpsertBrandMemorySourceBodySchema
>;

/** POST — optional vector kNN; without `queryEmbedding`, returns recent lexical rows only. */
export const BrandMemoryQueryBodySchema = z
  .object({
    workspaceId: z.string().min(1).max(200),
    brandId: z.string().min(1).max(200),
    queryEmbedding: z.array(z.number()).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.queryEmbedding === undefined) {
      return;
    }
    const parsed = parseBrandMemoryEmbedding1536(data.queryEmbedding);
    if (!parsed.ok) {
      ctx.addIssue({
        code: "custom",
        message: parsed.message,
        path: ["queryEmbedding"],
      });
    }
  });

export type BrandMemoryQueryBody = z.infer<typeof BrandMemoryQueryBodySchema>;
