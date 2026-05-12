import { describe, expect, it } from "vitest";

import {
  executeGetBrandProfileRequestFromSearchParams,
  executeListBrandProfilesRequestFromSearchParams,
  executeUpsertBrandProfileRequest,
} from "./brand-profile-route.js";

describe("brand-profile-route (Phase 1)", () => {
  it("executeUpsertBrandProfileRequest returns 400 on empty body", async () => {
    const r = await executeUpsertBrandProfileRequest({});
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it("executeGetBrandProfileRequestFromSearchParams returns 400 when tenantId missing", async () => {
    const sp = new URLSearchParams({ profileId: "p1" });
    const r = await executeGetBrandProfileRequestFromSearchParams(sp);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it("executeGetBrandProfileRequestFromSearchParams returns 400 on extra keys", async () => {
    const sp = new URLSearchParams({
      tenantId: "t1",
      profileId: "p1",
      extra: "x",
    });
    const r = await executeGetBrandProfileRequestFromSearchParams(sp);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it("executeListBrandProfilesRequestFromSearchParams returns 400 when tenantId missing", async () => {
    const sp = new URLSearchParams({ limit: "5" });
    const r = await executeListBrandProfilesRequestFromSearchParams(sp);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });
});
