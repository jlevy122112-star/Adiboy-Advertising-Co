import { describe, expect, it } from "vitest";
import type { TenantId, UserId } from "./tenant-context.js";
import {
  assertAuthenticatedTenantContext,
  isAuthenticatedTenantContext,
} from "./auth-context.js";

describe("isAuthenticatedTenantContext", () => {
  it("narrows when actorUserId is set", () => {
    const ctx = {
      tenantId: "t1" as TenantId,
      actorUserId: "u1" as UserId,
      actorRole: "tenant_admin" as const,
      requestId: "r1",
      source: "api" as const,
    };
    expect(isAuthenticatedTenantContext(ctx)).toBe(true);
  });

  it("returns false when actor is null", () => {
    const ctx = {
      tenantId: "t1" as TenantId,
      actorUserId: null,
      actorRole: "tenant_admin" as const,
      requestId: "r2",
      source: "api" as const,
    };
    expect(isAuthenticatedTenantContext(ctx)).toBe(false);
  });
});

describe("assertAuthenticatedTenantContext", () => {
  it("throws when actor is missing", () => {
    expect(() =>
      assertAuthenticatedTenantContext({
        tenantId: "t1" as TenantId,
        actorUserId: null,
        actorRole: "tenant_admin",
        requestId: "r-missing",
        source: "api",
      }),
    ).toThrow(/r-missing/);
  });
});
