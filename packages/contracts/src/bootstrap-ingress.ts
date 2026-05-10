import { roleCapabilityMatrix } from "./rbac.js";
import type {
  TenantContext,
  TenantContextSource,
  TenantId,
  TenantRole,
  UserId,
} from "./tenant-context.js";

/** Non-production header-based ingress; replace with a real IdP integration before production. */
export type BootstrapIngressHeaders = {
  readonly "x-home-link-tenant-id"?: string;
  readonly "x-home-link-user-id"?: string;
  readonly "x-home-link-actor-role"?: string;
  readonly "x-request-id"?: string;
};

export class IngressValidationError extends Error {
  override readonly name = "IngressValidationError";

  constructor(message: string) {
    super(message);
  }
}

function isTenantRole(value: string): value is TenantRole {
  return Object.hasOwn(roleCapabilityMatrix, value);
}

export type ParseBootstrapTenantContextOptions = {
  readonly requestId: string;
  readonly source?: TenantContextSource;
};

/**
 * Builds a {@link TenantContext} from bootstrap ingress headers.
 * Requires tenant id, non-empty actor user header, and a known {@link TenantRole}.
 */
export function parseBootstrapTenantContext(
  headers: BootstrapIngressHeaders,
  options: ParseBootstrapTenantContextOptions,
): TenantContext {
  const tenantIdRaw = headers["x-home-link-tenant-id"]?.trim();
  if (!tenantIdRaw) {
    throw new IngressValidationError(
      "Missing or empty x-home-link-tenant-id (bootstrap ingress).",
    );
  }

  const userIdRaw = headers["x-home-link-user-id"]?.trim();
  if (!userIdRaw) {
    throw new IngressValidationError(
      "Missing or empty x-home-link-user-id (bootstrap ingress). Authenticated requests require an actor user id.",
    );
  }

  const roleRaw = headers["x-home-link-actor-role"]?.trim();
  if (!roleRaw) {
    throw new IngressValidationError(
      "Missing or empty x-home-link-actor-role (bootstrap ingress).",
    );
  }

  if (!isTenantRole(roleRaw)) {
    throw new IngressValidationError(
      `Unknown actor role "${roleRaw}" (bootstrap ingress).`,
    );
  }

  return {
    tenantId: tenantIdRaw as TenantId,
    actorUserId: userIdRaw as UserId,
    actorRole: roleRaw,
    requestId: options.requestId,
    source: options.source ?? "api",
  };
}
