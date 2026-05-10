import type { TenantRole } from "./tenant-context.js";

export type TenantCapability =
  | "tenant.read"
  | "tenant.manage_members"
  | "lead.read"
  | "lead.create"
  | "lead.update"
  | "offer.read"
  | "offer.create"
  | "offer.update"
  | "billing.read"
  | "billing.manage";

export const roleCapabilityMatrix: Readonly<
  Record<TenantRole, readonly TenantCapability[]>
> = {
  platform_admin: [
    "tenant.read",
    "tenant.manage_members",
    "lead.read",
    "lead.create",
    "lead.update",
    "offer.read",
    "offer.create",
    "offer.update",
    "billing.read",
    "billing.manage",
  ],
  tenant_admin: [
    "tenant.read",
    "tenant.manage_members",
    "lead.read",
    "lead.create",
    "lead.update",
    "offer.read",
    "offer.create",
    "offer.update",
    "billing.read",
  ],
  acquisitions_manager: [
    "tenant.read",
    "lead.read",
    "lead.create",
    "lead.update",
    "offer.read",
    "offer.create",
    "offer.update",
  ],
  acquisitions_rep: ["tenant.read", "lead.read", "lead.create", "lead.update"],
  dispositions_manager: [
    "tenant.read",
    "lead.read",
    "offer.read",
    "offer.create",
    "offer.update",
  ],
  dispositions_rep: ["tenant.read", "lead.read", "offer.read", "offer.update"],
  finance_manager: [
    "tenant.read",
    "billing.read",
    "billing.manage",
    "offer.read",
  ],
  readonly_analyst: ["tenant.read", "lead.read", "offer.read", "billing.read"],
};

export function canRole(
  role: TenantRole,
  capability: TenantCapability,
): boolean {
  return roleCapabilityMatrix[role].includes(capability);
}
