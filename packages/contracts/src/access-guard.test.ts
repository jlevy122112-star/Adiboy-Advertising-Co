import { describe, expect, it } from "vitest";
import {
  evaluateCapabilityAccess,
  requireCapability,
  type AccessDecision,
} from "./access-guard.js";
import type { TenantContext, TenantId, UserId } from "./tenant-context.js";

function makeContext(
  overrides: Partial<TenantContext> & Pick<TenantContext, "requestId">,
): TenantContext {
  return {
    tenantId: (overrides.tenantId ?? "tid-1") as TenantId,
    actorUserId:
      overrides.actorUserId === undefined
        ? ("uid-1" as UserId)
        : overrides.actorUserId,
    actorRole: overrides.actorRole ?? "tenant_admin",
    requestId: overrides.requestId,
    source: overrides.source ?? "api",
  };
}

describe("evaluateCapabilityAccess", () => {
  it("denies when actor is missing", () => {
    const decision = evaluateCapabilityAccess(
      makeContext({
        requestId: "req-1",
        actorUserId: null,
      }),
      "tenant.read",
    );

    expect(decision).toEqual({
      allowed: false,
      reason: "missing_authenticated_actor",
    });
  });

  it("denies when capability is missing for role", () => {
    const decision = evaluateCapabilityAccess(
      makeContext({
        requestId: "req-2",
        actorRole: "acquisitions_rep",
      }),
      "billing.read",
    );

    expect(decision).toEqual({
      allowed: false,
      reason: "missing_capability",
    });
  });

  it("allows when actor and capability are present", () => {
    const tenant = makeContext({
      requestId: "req-3",
      actorRole: "tenant_admin",
    });
    const decision = evaluateCapabilityAccess(tenant, "tenant.read");

    expect(decision.allowed).toBe(true);
    const allowed = decision as Extract<AccessDecision, { allowed: true }>;
    expect(allowed.context.tenantId).toBe(tenant.tenantId);
  });
});

describe("requireCapability", () => {
  it("throws for missing authenticated actor", () => {
    const tenant = makeContext({
      requestId: "req-rc-1",
      actorUserId: null,
    });

    expect(() => requireCapability(tenant, "tenant.read")).toThrow(
      /req-rc-1.*missing_authenticated_actor/,
    );
  });

  it("throws for missing capability", () => {
    const tenant = makeContext({
      requestId: "req-rc-2",
      actorRole: "acquisitions_rep",
    });

    expect(() => requireCapability(tenant, "billing.read")).toThrow(
      /req-rc-2.*missing_capability.*billing\.read/,
    );
  });

  it("does not throw when capability is satisfied", () => {
    const tenant = makeContext({
      requestId: "req-rc-3",
      actorRole: "tenant_admin",
    });

    expect(() => requireCapability(tenant, "tenant.read")).not.toThrow();
  });
});
