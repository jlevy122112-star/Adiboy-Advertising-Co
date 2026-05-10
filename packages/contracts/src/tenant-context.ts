export type TenantId = string & { readonly __brand: "TenantId" };
export type UserId = string & { readonly __brand: "UserId" };

export type TenantRole =
  | "platform_admin"
  | "tenant_admin"
  | "acquisitions_manager"
  | "acquisitions_rep"
  | "dispositions_manager"
  | "dispositions_rep"
  | "finance_manager"
  | "readonly_analyst";

export type TenantContextSource = "api" | "job" | "system";
const TENANT_CONTEXT_SOURCES: readonly TenantContextSource[] = [
  "api",
  "job",
  "system",
];

export type TenantContext = {
  tenantId: TenantId;
  actorUserId: UserId | null;
  actorRole: TenantRole;
  requestId: string;
  source: TenantContextSource;
};

export type TenantContextEnvelope<TPayload> = {
  tenant: TenantContext;
  payload: TPayload;
};

export function hasTenantContext(
  value: unknown,
): value is TenantContextEnvelope<unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const tenant = record.tenant;
  if (typeof tenant !== "object" || tenant === null) {
    return false;
  }

  const tenantRecord = tenant as Record<string, unknown>;
  return (
    typeof tenantRecord.tenantId === "string" &&
    typeof tenantRecord.actorRole === "string" &&
    typeof tenantRecord.requestId === "string" &&
    typeof tenantRecord.source === "string" &&
    TENANT_CONTEXT_SOURCES.includes(
      tenantRecord.source as TenantContextSource,
    ) &&
    (tenantRecord.actorUserId === null ||
      typeof tenantRecord.actorUserId === "string")
  );
}
