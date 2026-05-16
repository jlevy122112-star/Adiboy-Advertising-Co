import { describe, expect, it } from "vitest";
import {
  AttachScheduleEntryCampaignBodySchema,
  isKnownScheduleEntryStatus,
  isTerminalScheduleEntryStatus,
  ListScheduleEntriesForCampaignQuerySchema,
  scheduleEntryRecordFromSqlRow,
  ScheduleEntryStatusSchema,
} from "./content-calendar.js";

describe("content-calendar", () => {
  it("maps SQL row to record (string timestamps)", () => {
    const rec = scheduleEntryRecordFromSqlRow({
      id: "se_1",
      tenant_id: "t1",
      campaign_id: null,
      network: "x",
      status: "scheduled",
      content_summary: "Hello",
      scheduled_at: null,
      created_at: "2026-05-01T10:00:00.000Z",
      updated_at: "2026-05-02T11:00:00.000Z",
    });
    expect(rec).toEqual({
      tenantId: "t1",
      scheduleEntryId: "se_1",
      campaignId: null,
      network: "x",
      status: "scheduled",
      contentSummary: "Hello",
      scheduledAt: null,
      createdAt: "2026-05-01T10:00:00.000Z",
      updatedAt: "2026-05-02T11:00:00.000Z",
    });
  });

  it("maps SQL row with Date timestamps", () => {
    const d1 = new Date("2026-05-01T10:00:00.000Z");
    const d2 = new Date("2026-05-02T11:00:00.000Z");
    const rec = scheduleEntryRecordFromSqlRow({
      id: "se_2",
      tenant_id: "t2",
      campaign_id: "cmp_a",
      network: null,
      status: "published",
      content_summary: null,
      scheduled_at: null,
      created_at: d1,
      updated_at: d2,
    });
    expect(rec.scheduleEntryId).toBe("se_2");
    expect(rec.campaignId).toBe("cmp_a");
    expect(rec.network).toBeNull();
    expect(rec.contentSummary).toBeNull();
    expect(rec.createdAt).toBe(d1.toISOString());
    expect(rec.updatedAt).toBe(d2.toISOString());
  });

  it("accepts arbitrary status strings from DB", () => {
    const rec = scheduleEntryRecordFromSqlRow({
      id: "x",
      tenant_id: "y",
      campaign_id: null,
      network: null,
      status: "legacy_custom",
      content_summary: null,
      scheduled_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    expect(rec.status).toBe("legacy_custom");
    expect(isKnownScheduleEntryStatus(rec.status)).toBe(false);
  });

  it("isKnownScheduleEntryStatus recognizes enum values", () => {
    expect(isKnownScheduleEntryStatus("queued")).toBe(true);
    expect(isKnownScheduleEntryStatus("cancelled")).toBe(true);
    expect(ScheduleEntryStatusSchema.parse("failed")).toBe("failed");
  });

  it("isTerminalScheduleEntryStatus is true only for published, failed, cancelled", () => {
    expect(isTerminalScheduleEntryStatus("published")).toBe(true);
    expect(isTerminalScheduleEntryStatus("failed")).toBe(true);
    expect(isTerminalScheduleEntryStatus("cancelled")).toBe(true);
    expect(isTerminalScheduleEntryStatus("scheduled")).toBe(false);
    expect(isTerminalScheduleEntryStatus("draft")).toBe(false);
    expect(isTerminalScheduleEntryStatus("legacy_custom")).toBe(false);
  });

  it("AttachScheduleEntryCampaignBodySchema accepts null campaignId", () => {
    const b = AttachScheduleEntryCampaignBodySchema.parse({
      tenantId: "t1",
      scheduleEntryId: "se_1",
      campaignId: null,
    });
    expect(b.campaignId).toBeNull();
  });

  it("ListScheduleEntriesForCampaignQuerySchema coerces limit and defaults", () => {
    const q = ListScheduleEntriesForCampaignQuerySchema.parse({
      tenantId: "t1",
      campaignId: "cmp_1",
    });
    expect(q.limit).toBe(50);
    const q2 = ListScheduleEntriesForCampaignQuerySchema.parse({
      tenantId: "t1",
      campaignId: "cmp_1",
      limit: "10",
    });
    expect(q2.limit).toBe(10);
  });
});
