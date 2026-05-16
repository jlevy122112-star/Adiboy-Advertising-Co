import { describe, expect, it } from "vitest";

import {
  BRAND_MEMORY_EMBEDDING_DIMENSION,
  parseBrandMemoryEmbedding1536,
  parseOptionalBrandMemoryEmbedding1536,
} from "./brand-memory-embedding.js";

describe("parseBrandMemoryEmbedding1536", () => {
  it("accepts exactly 1536 finite numbers", () => {
    const v = new Array(BRAND_MEMORY_EMBEDDING_DIMENSION).fill(0.1);
    const r = parseBrandMemoryEmbedding1536(v);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.embedding.length).toBe(1536);
  });

  it("rejects wrong length", () => {
    const r = parseBrandMemoryEmbedding1536([1, 2, 3]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("wrong_length");
  });

  it("parseOptional returns null for null/undefined", () => {
    expect(parseOptionalBrandMemoryEmbedding1536(null)).toEqual({
      ok: true,
      embedding: null,
    });
    expect(parseOptionalBrandMemoryEmbedding1536(undefined)).toEqual({
      ok: true,
      embedding: null,
    });
  });
});
