import { describe, expect, it } from "vitest";
import { PublishJobPayloadSchema } from "./publish-job.js";

describe("PublishJobPayloadSchema", () => {
  it("accepts minimal valid payload", () => {
    const parsed = PublishJobPayloadSchema.parse({
      scheduleEntryId: "sched_1",
      tenantId: "tenant_a",
    });
    expect(parsed.tenantId).toBe("tenant_a");
  });

  it("accepts idempotency key for dedupe", () => {
    const parsed = PublishJobPayloadSchema.parse({
      scheduleEntryId: "sched_1",
      tenantId: "tenant_a",
      idempotencyKey: "idem-v1",
    });
    expect(parsed.idempotencyKey).toBe("idem-v1");
  });

  it("rejects empty tenantId", () => {
    expect(() =>
      PublishJobPayloadSchema.parse({
        scheduleEntryId: "x",
        tenantId: "",
      }),
    ).toThrow();
  });
});
