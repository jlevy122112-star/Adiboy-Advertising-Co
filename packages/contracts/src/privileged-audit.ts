import type { TenantCapability } from "./rbac.js";
import type { AccessDecision } from "./access-guard.js";
import type {
  TenantContextSource,
  TenantId,
  UserId,
  TenantRole,
  TenantContext,
} from "./tenant-context.js";

export type PrivilegedAuditOutcome = "allowed" | "denied";

export type PrivilegeDenyReason = Extract<
  AccessDecision,
  { allowed: false }
>["reason"];

export type PrivilegedAuditEvent = {
  kind: "privileged_capability_check";
  occurredAtIso: string;
  action: string;
  tenantId: TenantId;
  requestId: string;
  source: TenantContextSource;
  actorUserId: UserId | null;
  actorRole: TenantRole;
  capability: TenantCapability;
  outcome: PrivilegedAuditOutcome;
  denyReason?: PrivilegeDenyReason;
};

export function privilegedCapabilityAudit(params: {
  context: TenantContext;
  capability: TenantCapability;
  decision: AccessDecision;
  action: string;
  now?: Date;
}): PrivilegedAuditEvent {
  const instant = params.now ?? new Date();
  const outcome: PrivilegedAuditOutcome = params.decision.allowed
    ? "allowed"
    : "denied";

  return {
    kind: "privileged_capability_check",
    occurredAtIso: instant.toISOString(),
    action: params.action,
    tenantId: params.context.tenantId,
    requestId: params.context.requestId,
    source: params.context.source,
    actorUserId: params.context.actorUserId,
    actorRole: params.context.actorRole,
    capability: params.capability,
    outcome,
    denyReason:
      params.decision.allowed === false ? params.decision.reason : undefined,
  };
}
