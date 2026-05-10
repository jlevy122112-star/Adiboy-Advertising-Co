import type { TenantCapability } from "./rbac.js";
import { canRole } from "./rbac.js";
import type { TenantContext } from "./tenant-context.js";
import {
  toAccessAuditCallback,
  type AccessAuditCallback,
  type AccessAuditSink,
} from "./access-audit.js";
import {
  assertAuthenticatedTenantContext,
  type AuthenticatedTenantContext,
} from "./auth-context.js";

export type AccessDecisionReason =
  | "missing_authenticated_actor"
  | "missing_capability";

export type AccessDecision =
  | {
      allowed: true;
      context: AuthenticatedTenantContext;
    }
  | {
      allowed: false;
      reason: AccessDecisionReason;
    };

export type CapabilityAuditEvent = {
  eventType: "auth.capability_check";
  occurredAt: string;
  requestId: string;
  tenantId: TenantContext["tenantId"];
  actorUserId: TenantContext["actorUserId"];
  actorRole: TenantContext["actorRole"];
  capability: TenantCapability;
  outcome: "allowed" | "denied";
  reason: AccessDecisionReason | null;
};

export class AccessDeniedError extends Error {
  readonly auditEvent: CapabilityAuditEvent;

  constructor(auditEvent: CapabilityAuditEvent) {
    super(
      `Access denied for request ${auditEvent.requestId}: ${auditEvent.reason} (${auditEvent.capability}).`,
    );
    this.name = "AccessDeniedError";
    this.auditEvent = auditEvent;
  }
}

export function evaluateCapabilityAccess(
  context: TenantContext,
  capability: TenantCapability,
): AccessDecision {
  if (context.actorUserId === null) {
    return {
      allowed: false,
      reason: "missing_authenticated_actor",
    };
  }

  if (!canRole(context.actorRole, capability)) {
    return {
      allowed: false,
      reason: "missing_capability",
    };
  }

  return {
    allowed: true,
    context: context as AuthenticatedTenantContext,
  };
}

export function createCapabilityAuditEvent(
  context: TenantContext,
  capability: TenantCapability,
  decision: AccessDecision,
  occurredAt: string = new Date().toISOString(),
): CapabilityAuditEvent {
  return {
    eventType: "auth.capability_check",
    occurredAt,
    requestId: context.requestId,
    tenantId: context.tenantId,
    actorUserId: context.actorUserId,
    actorRole: context.actorRole,
    capability,
    outcome: decision.allowed ? "allowed" : "denied",
    reason: decision.allowed ? null : decision.reason,
  };
}

export function authorizeCapability(
  context: TenantContext,
  capability: TenantCapability,
): { decision: AccessDecision; auditEvent: CapabilityAuditEvent } {
  const decision = evaluateCapabilityAccess(context, capability);
  return {
    decision,
    auditEvent: createCapabilityAuditEvent(context, capability, decision),
  };
}

export function requireCapability(
  context: TenantContext,
  capability: TenantCapability,
  auditHandler?: AccessAuditSink | AccessAuditCallback,
): asserts context is AuthenticatedTenantContext {
  const { decision, auditEvent } = authorizeCapability(context, capability);
  const onAuditEvent = toAccessAuditCallback(auditHandler);
  onAuditEvent?.(auditEvent);
  if (!decision.allowed) {
    throw new AccessDeniedError(auditEvent);
  }

  assertAuthenticatedTenantContext(context);
}
