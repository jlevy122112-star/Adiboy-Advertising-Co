import type { TenantContext, UserId } from "./tenant-context.js";

export type AuthenticatedTenantContext = Omit<TenantContext, "actorUserId"> & {
  actorUserId: UserId;
};

export function isAuthenticatedTenantContext(
  context: TenantContext,
): context is AuthenticatedTenantContext {
  return context.actorUserId !== null;
}

export function assertAuthenticatedTenantContext(
  context: TenantContext,
): asserts context is AuthenticatedTenantContext {
  if (!isAuthenticatedTenantContext(context)) {
    throw new Error(
      `Missing authenticated actor for request ${context.requestId}.`,
    );
  }
}
