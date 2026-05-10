import { describe, expect, it } from "vitest";
import {
  PublishJobPayloadSchema,
  PublishJobResultSchema,
} from "./publish-job.js";

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

describe("PublishJobResultSchema", () => {
  it("preserves externalId returned by provider adapters and HTTP runner", () => {
    const parsed = PublishJobResultSchema.parse({
      ok: true,
      detail: "published",
      externalId: "meta:post_123",
    });

    expect(parsed).toEqual({
      ok: true,
      detail: "published",
      externalId: "meta:post_123",
    });
  });
});
