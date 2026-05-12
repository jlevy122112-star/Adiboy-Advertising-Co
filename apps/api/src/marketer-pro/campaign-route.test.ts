import { describe, expect, it } from "vitest";

import {
  executeAttachScheduleEntryCampaignRequest,
  executeCreateCampaignRequest,
  executeGetCampaignRequestFromSearchParams,
  executeListCampaignsRequestFromSearchParams,
  executeListScheduleEntriesForCampaignRequestFromSearchParams,
} from "./campaign-route.js";

describe("campaign-route (Phase 4)", () => {
  it("executeAttachScheduleEntryCampaignRequest returns 400 on empty body", async () => {
    const r = await executeAttachScheduleEntryCampaignRequest({});
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it("executeCreateCampaignRequest returns 400 on empty body", async () => {
    const r = await executeCreateCampaignRequest({});
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it("executeGetCampaignRequestFromSearchParams returns 400 when tenantId missing", async () => {
    const params = new URLSearchParams({ campaignId: "c1" });
    const r = await executeGetCampaignRequestFromSearchParams(params);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it("executeListCampaignsRequestFromSearchParams returns 400 when tenantId missing", async () => {
    const params = new URLSearchParams({ limit: "5" });
    const r = await executeListCampaignsRequestFromSearchParams(params);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it("executeListScheduleEntriesForCampaignRequestFromSearchParams returns 400 when tenantId missing", async () => {
    const params = new URLSearchParams({ campaignId: "c1" });
    const r =
      await executeListScheduleEntriesForCampaignRequestFromSearchParams(
        params,
      );
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });
});
