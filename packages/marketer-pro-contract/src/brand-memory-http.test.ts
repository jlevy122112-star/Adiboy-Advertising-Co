import { describe, expect, test } from "vitest";

import {
  BrandMemoryEmbeddingBlockSchema,
  BrandMemoryQueryBodySchema,
  UpsertBrandMemorySourceBodySchema,
} from "./brand-memory-http.js";

describe("UpsertBrandMemorySourceBodySchema", () => {
  test("parses minimal body", () => {
    const r = UpsertBrandMemorySourceBodySchema.safeParse({
      workspaceId: "ws",
      brandId: "br",
      sourceId: "src",
      version: "v1",
      sourceType: "doc",
      text: "hello world",
    });
    expect(r.success).toBe(true);
  });

  test("rejects strict extra keys", () => {
    const r = UpsertBrandMemorySourceBodySchema.safeParse({
      workspaceId: "ws",
      brandId: "br",
      sourceId: "src",
      version: "v1",
      sourceType: "doc",
      text: "hello",
      extra: 1,
    });
    expect(r.success).toBe(false);
  });

  test("embedding block rejects wrong dims literal", () => {
    const r = UpsertBrandMemorySourceBodySchema.safeParse({
      workspaceId: "ws",
      brandId: "br",
      sourceId: "src",
      version: "v1",
      sourceType: "doc",
      text: "hello",
      embedding: { dims: 999, chunks: [] },
    });
    expect(r.success).toBe(false);
  });
});

describe("BrandMemoryEmbeddingBlockSchema", () => {
  test("accepts 1536-length vectors", () => {
    const vec = Array.from({ length: 1536 }, (_, i) => (i === 0 ? 1 : 0) as number);
    const r = BrandMemoryEmbeddingBlockSchema.safeParse({
      dims: 1536,
      chunks: [{ chunkIndex: 0, vector: vec }],
    });
    expect(r.success).toBe(true);
  });

  test("rejects short vector", () => {
    const r = BrandMemoryEmbeddingBlockSchema.safeParse({
      dims: 1536,
      chunks: [{ chunkIndex: 0, vector: [0.1, 0.2] }],
    });
    expect(r.success).toBe(false);
  });
});

describe("BrandMemoryQueryBodySchema", () => {
  test("allows omitting queryEmbedding", () => {
    const r = BrandMemoryQueryBodySchema.safeParse({
      workspaceId: "ws",
      brandId: "br",
    });
    expect(r.success).toBe(true);
  });

  test("rejects bad query embedding length", () => {
    const r = BrandMemoryQueryBodySchema.safeParse({
      workspaceId: "ws",
      brandId: "br",
      queryEmbedding: [1, 2, 3],
    });
    expect(r.success).toBe(false);
  });
});
