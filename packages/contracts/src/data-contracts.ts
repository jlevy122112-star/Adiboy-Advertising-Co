import type { TenantContextEnvelope, TenantId } from "./tenant-context.js";

export type TenantScopedRecord = {
  id: string;
  tenantId: TenantId;
  createdAt: string;
  updatedAt: string;
};

export type SoftDeleteFields = {
  deletedAt: string | null;
  deletedByUserId: string | null;
};

export type AuditableTenantRecord = TenantScopedRecord & SoftDeleteFields;

export type TenantScopedMutation<TPayload> = TenantContextEnvelope<TPayload> & {
  reason: string;
};

export function sameTenant(
  left: TenantScopedRecord,
  right: TenantScopedRecord,
): boolean {
  return left.tenantId === right.tenantId;
}
