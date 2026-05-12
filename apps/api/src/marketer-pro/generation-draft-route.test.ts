import { describe, expect, it } from "vitest";

import {
  executeGetGenerationDraftRequestFromSearchParams,
  executeListGenerationDraftsRequestFromSearchParams,
  executeRejectGenerationDraftRequest,
} from "./generation-draft-route.js";

describe("executeGetGenerationDraftRequestFromSearchParams (Phase 2)", () => {
  it("returns 400 when query fails validation", async () => {
    const sp = new URLSearchParams();
    const r = await executeGetGenerationDraftRequestFromSearchParams(sp);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it("returns 400 when extra query keys present (strict)", async () => {
    const sp = new URLSearchParams({
      tenantId: "t1",
      draftId: "d1",
      extra: "x",
    });
    const r = await executeGetGenerationDraftRequestFromSearchParams(sp);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });
});

describe("executeListGenerationDraftsRequestFromSearchParams (Phase 2)", () => {
  it("returns 400 when briefId missing", async () => {
    const sp = new URLSearchParams({ tenantId: "t1" });
    const r = await executeListGenerationDraftsRequestFromSearchParams(sp);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });
});

describe("executeRejectGenerationDraftRequest (Phase 2)", () => {
  it("returns 400 when body fails validation", async () => {
    const r = await executeRejectGenerationDraftRequest({});
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
    if (!r.ok) {
      expect(r.body).toMatchObject({ error: "validation_error" });
    }
  });

  it("returns 400 when actorUserId missing", async () => {
    const r = await executeRejectGenerationDraftRequest({
      tenantId: "t1",
      draftId: "d1",
    });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });
});
