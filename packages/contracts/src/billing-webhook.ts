import type { TenantId } from "./tenant-context.js";

export type SubscriptionStatus =
  | "inactive"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

export type BillingWebhookEventType =
  | "customer.subscription.created"
  | "customer.subscription.updated"
  | "customer.subscription.deleted"
  | "invoice.payment_succeeded";

export type BillingWebhookEnvelope = {
  readonly id: string;
  readonly type: BillingWebhookEventType;
  readonly tenantId: TenantId;
  readonly subscriptionId: string;
  readonly status: SubscriptionStatus;
  readonly occurredAtIso: string;
};

export class BillingWebhookPayloadError extends Error {
  override readonly name = "BillingWebhookPayloadError";

  constructor(message: string) {
    super(message);
  }
}

const EVENT_TYPES: ReadonlySet<string> = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_succeeded",
]);

const STATUSES: ReadonlySet<string> = new Set([
  "inactive",
  "trialing",
  "active",
  "past_due",
  "canceled",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseBillingWebhookEnvelope(
  rawBody: string,
): BillingWebhookEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new BillingWebhookPayloadError("Webhook body is not valid JSON.");
  }

  if (!isRecord(parsed)) {
    throw new BillingWebhookPayloadError("Webhook body must be a JSON object.");
  }

  const id = parsed.id;
  const type = parsed.type;
  const data = parsed.data;

  if (typeof id !== "string" || !id.trim()) {
    throw new BillingWebhookPayloadError("Missing or invalid event id.");
  }

  if (typeof type !== "string" || !EVENT_TYPES.has(type)) {
    throw new BillingWebhookPayloadError("Missing or invalid event type.");
  }

  if (!isRecord(data)) {
    throw new BillingWebhookPayloadError("Missing event data object.");
  }

  const tenantId = data.tenantId;
  const subscriptionId = data.subscriptionId;
  const status = data.status;
  const occurredAtIso = data.occurredAtIso;

  if (typeof tenantId !== "string" || !tenantId.trim()) {
    throw new BillingWebhookPayloadError("Missing tenantId in event data.");
  }
  if (typeof subscriptionId !== "string" || !subscriptionId.trim()) {
    throw new BillingWebhookPayloadError(
      "Missing subscriptionId in event data.",
    );
  }
  if (typeof status !== "string" || !STATUSES.has(status)) {
    throw new BillingWebhookPayloadError(
      "Missing or invalid subscription status.",
    );
  }
  if (typeof occurredAtIso !== "string" || !occurredAtIso.trim()) {
    throw new BillingWebhookPayloadError(
      "Missing occurredAtIso in event data.",
    );
  }

  return {
    id: id.trim(),
    type: type as BillingWebhookEventType,
    tenantId: tenantId.trim() as TenantId,
    subscriptionId: subscriptionId.trim(),
    status: status as SubscriptionStatus,
    occurredAtIso: occurredAtIso.trim(),
  };
}
