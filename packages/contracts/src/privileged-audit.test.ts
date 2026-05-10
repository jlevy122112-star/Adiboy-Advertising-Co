import { describe, expect, it } from "vitest";
import { evaluateCapabilityAccess } from "./access-guard.js";
import { privilegedCapabilityAudit } from "./privileged-audit.js";
import type { TenantId, TenantContext, UserId } from "./tenant-context.js";

function makeTenant(
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

describe("privilegedCapabilityAudit", () => {
  it("records allowed outcome without denyReason", () => {
    const tenant = makeTenant({ requestId: "req-audit-1" });
    const decision = evaluateCapabilityAccess(tenant, "tenant.read");
    const fixed = new Date("2026-05-06T12:00:00.000Z");

    expect(decision.allowed).toBe(true);

    const event = privilegedCapabilityAudit({
      context: tenant,
      capability: "tenant.read",
      decision,
      action: "test privileged action",
      now: fixed,
    });

    expect(event).toMatchObject({
      kind: "privileged_capability_check",
      occurredAtIso: "2026-05-06T12:00:00.000Z",
      action: "test privileged action",
      tenantId: tenant.tenantId,
      requestId: "req-audit-1",
      source: "api",
      capability: "tenant.read",
      outcome: "allowed",
    });
    expect(event.denyReason).toBeUndefined();
  });

  it("records denied outcome with denyReason", () => {
    const tenant = makeTenant({
      requestId: "req-audit-2",
      actorRole: "acquisitions_rep",
    });
    const decision = evaluateCapabilityAccess(tenant, "billing.read");
    expect(decision.allowed).toBe(false);

    const event = privilegedCapabilityAudit({
      context: tenant,
      capability: "billing.read",
      decision,
      action: "test denial",
      now: new Date("2026-05-06T13:00:00.000Z"),
    });

    expect(event.outcome).toBe("denied");
    expect(event.denyReason).toBe("missing_capability");
  });
});
