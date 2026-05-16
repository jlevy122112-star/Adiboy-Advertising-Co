/**
 * Brand memory embeddings — contract-only validation (no embedder calls).
 *
 * Product rules:
 * - Exactly **1536** floats when an embedding is supplied (ingest or query).
 * - **NULL** / omitted in storage = lexical-only chunk (skipped by vector SQL paths).
 * - One dimension per `(workspaceId, brandId)` scope in this table family; wrong length → API **400**.
 */

import { z } from "zod";

/** pgvector column width for `brand_memory_chunks.embedding` in migration `006_*`. */
export const BRAND_MEMORY_EMBEDDING_DIMENSION = 1536 as const;

const Dim = BRAND_MEMORY_EMBEDDING_DIMENSION;

/** Strict finite float array of length 1536 (caller-supplied; no generation here). */
export const BrandMemoryEmbedding1536Schema = z
  .array(z.number().finite())
  .length(Dim);

export type BrandMemoryEmbedding1536 = z.infer<
  typeof BrandMemoryEmbedding1536Schema
>;

export type BrandMemoryEmbedding1536Parse =
  | { readonly ok: true; readonly embedding: BrandMemoryEmbedding1536 }
  | {
      readonly ok: false;
      readonly code: "wrong_length" | "invalid_number" | "not_array";
      readonly message: string;
    };

export function parseBrandMemoryEmbedding1536(
  value: unknown,
): BrandMemoryEmbedding1536Parse {
  if (!Array.isArray(value)) {
    return {
      ok: false,
      code: "not_array",
      message: "embedding must be a number[]",
    };
  }
  if (value.length !== Dim) {
    return {
      ok: false,
      code: "wrong_length",
      message: `embedding must have length exactly ${Dim}, got ${value.length}`,
    };
  }
  const parsed = BrandMemoryEmbedding1536Schema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid_number",
      message: parsed.error.message,
    };
  }
  return { ok: true, embedding: parsed.data };
}

/** Optional embedding: undefined / null = lexical-only; present must parse as 1536-dim. */
export function parseOptionalBrandMemoryEmbedding1536(
  value: unknown,
): BrandMemoryEmbedding1536Parse | { readonly ok: true; readonly embedding: null } {
  if (value === undefined || value === null) {
    return { ok: true, embedding: null };
  }
  return parseBrandMemoryEmbedding1536(value);
}
