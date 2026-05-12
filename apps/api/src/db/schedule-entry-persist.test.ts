import { describe, expect, it } from "vitest";

import { planScheduleEntryPublishPersist } from "./schedule-entry.js";

describe("planScheduleEntryPublishPersist", () => {
  it("skips when postgres read failed", () => {
    expect(
      planScheduleEntryPublishPersist({
        ok: false,
        detail: "postgres_query_failed:connection refused",
      }),
    ).toEqual({ action: "skip", reason: "postgres_read_error" });
  });

  it("skips when schedule row missing", () => {
    expect(
      planScheduleEntryPublishPersist({
        ok: false,
        detail: "schedule_entry_not_found_in_postgres",
      }),
    ).toEqual({ action: "skip", reason: "not_found" });
  });

  it("updates published on success", () => {
    expect(
      planScheduleEntryPublishPersist({ ok: true, detail: "p4_stub_meta_wire_sdk" }),
    ).toEqual({ action: "update", status: "published" });
  });

  it("updates failed on provider failure", () => {
    expect(
      planScheduleEntryPublishPersist({
        ok: false,
        detail: "rate_limited",
      }),
    ).toEqual({ action: "update", status: "failed" });
  });
});
