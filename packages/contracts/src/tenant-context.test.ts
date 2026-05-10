import { describe, expect, it } from "vitest";
import { hasTenantContext, type TenantContext } from "./tenant-context.js";

describe("hasTenantContext", () => {
  it("returns true for a well-formed envelope", () => {
    const envelope = {
      tenant: {
        tenantId: "t1",
        actorUserId: "u1" as const,
        actorRole: "tenant_admin",
        requestId: "r1",
        source: "api",
      } satisfies TenantContext,
      payload: {},
    };

    expect(hasTenantContext(envelope)).toBe(true);
  });

  it("returns false for non-objects", () => {
    expect(hasTenantContext(null)).toBe(false);
    expect(hasTenantContext("x")).toBe(false);
  });

  it("returns false when tenant is malformed", () => {
    expect(
      hasTenantContext({
        tenant: { tenantId: "t1" },
        payload: null,
      }),
    ).toBe(false);
  });
});
