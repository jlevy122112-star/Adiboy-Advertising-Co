import { describe, expect, it } from "vitest";

import {
  executeBrandMemoryQueryRequest,
  executeUpsertBrandMemorySourceRequest,
} from "./brand-memory-route.js";

describe("brand-memory-route (Phase 1)", () => {
  it("executeUpsertBrandMemorySourceRequest returns 400 on empty body", async () => {
    const r = await executeUpsertBrandMemorySourceRequest({});
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it("executeUpsertBrandMemorySourceRequest returns 400 on extra keys", async () => {
    const r = await executeUpsertBrandMemorySourceRequest({
      workspaceId: "w",
      brandId: "b",
      sourceId: "s",
      version: "v1",
      sourceType: "doc",
      text: "hello world",
      extra: 1,
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it("executeBrandMemoryQueryRequest returns 400 when workspaceId missing", async () => {
    const r = await executeBrandMemoryQueryRequest({ brandId: "b" });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it("executeBrandMemoryQueryRequest returns 400 on bad embedding length", async () => {
    const r = await executeBrandMemoryQueryRequest({
      workspaceId: "w",
      brandId: "b",
      queryEmbedding: [0.1, 0.2],
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });
});
