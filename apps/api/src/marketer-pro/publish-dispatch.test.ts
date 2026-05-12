import { describe, expect, it } from "vitest";
import { dispatchPublishByNetwork } from "./publish-dispatch.js";

const ctx = { jobId: "j1", attempt: 1 } as const;

describe("dispatchPublishByNetwork", () => {
  it("routes meta", async () => {
    const r = await dispatchPublishByNetwork(
      {
        scheduleEntryId: "s1",
        tenantId: "t1",
        network: "meta",
      },
      ctx,
    );
    expect(r.ok).toBe(true);
    expect(r.detail).toMatch(/p4_stub_meta_wire_sdk/);
    expect(r.externalId).toBe("meta:s1");
  });

  it("routes generic for unknown network slug", async () => {
    const r = await dispatchPublishByNetwork(
      {
        scheduleEntryId: "s2",
        tenantId: "t1",
        network: "smoke",
      },
      ctx,
    );
    expect(r.detail).toContain("p4_stub_generic");
    expect(r.externalId).toBe("generic:s2");
  });

  it("maps facebook → meta", async () => {
    const r = await dispatchPublishByNetwork(
      {
        scheduleEntryId: "s3",
        tenantId: "t1",
        network: "facebook",
      },
      ctx,
    );
    expect(r.externalId).toBe("meta:s3");
  });

  it("includes adaptation marker in stub detail when copy is present", async () => {
    const r = await dispatchPublishByNetwork(
      {
        scheduleEntryId: "s9",
        tenantId: "t1",
        network: "x",
        copy: { body: "z".repeat(400) },
      },
      ctx,
    );
    expect(r.ok).toBe(true);
    expect(r.detail).toMatch(/p4_stub_x_wire_sdk/);
    expect(r.detail).toContain("_adapted:w=");
  });

  it("does not adapt copy for generic route", async () => {
    const r = await dispatchPublishByNetwork(
      {
        scheduleEntryId: "s10",
        tenantId: "t1",
        network: "smoke",
        copy: { body: "hello" },
      },
      ctx,
    );
    expect(r.ok).toBe(true);
    expect(r.detail).not.toContain("_adapted:");
  });
});
