import { describe, expect, it } from "vitest";
import {
  campaignRecordFromSqlRow,
  CampaignStatusSchema,
  CreateCampaignBodySchema,
  isKnownCampaignStatus,
} from "./campaign.js";

describe("campaign", () => {
  it("maps SQL row to record", () => {
    const rec = campaignRecordFromSqlRow({
      id: "cmp_1",
      tenant_id: "t1",
      name: "Spring launch",
      status: "active",
      created_at: "2026-05-01T10:00:00.000Z",
      updated_at: "2026-05-02T11:00:00.000Z",
    });
    expect(rec).toEqual({
      tenantId: "t1",
      campaignId: "cmp_1",
      name: "Spring launch",
      status: "active",
      createdAt: "2026-05-01T10:00:00.000Z",
      updatedAt: "2026-05-02T11:00:00.000Z",
    });
  });

  it("accepts legacy status strings while isKnownCampaignStatus is strict", () => {
    const rec = campaignRecordFromSqlRow({
      id: "c",
      tenant_id: "t",
      name: "X",
      status: "legacy",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    expect(rec.status).toBe("legacy");
    expect(isKnownCampaignStatus(rec.status)).toBe(false);
    expect(isKnownCampaignStatus("draft")).toBe(true);
    expect(CampaignStatusSchema.parse("cancelled")).toBe("cancelled");
  });

  it("CreateCampaignBodySchema accepts optional status and rejects invalid status", () => {
    const minimal = CreateCampaignBodySchema.parse({
      tenantId: "t1",
      campaignId: "c1",
      name: "Launch",
    });
    expect(minimal.status).toBeUndefined();
    const withStatus = CreateCampaignBodySchema.parse({
      tenantId: "t1",
      campaignId: "c1",
      name: "Launch",
      status: "active",
    });
    expect(withStatus.status).toBe("active");
    const bad = CreateCampaignBodySchema.safeParse({
      tenantId: "t1",
      campaignId: "c1",
      name: "Launch",
      status: "not_a_real_status",
    });
    expect(bad.success).toBe(false);
  });
});
