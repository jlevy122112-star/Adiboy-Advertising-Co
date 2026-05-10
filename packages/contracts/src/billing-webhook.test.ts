import { describe, expect, it } from "vitest";
import {
  BillingWebhookPayloadError,
  parseBillingWebhookEnvelope,
} from "./billing-webhook.js";

const validBody = JSON.stringify({
  id: "evt_1",
  type: "customer.subscription.updated",
  data: {
    tenantId: "tenant_a",
    subscriptionId: "sub_1",
    status: "active",
    occurredAtIso: "2026-05-06T12:00:00.000Z",
  },
});

describe("parseBillingWebhookEnvelope", () => {
  it("parses a valid envelope", () => {
    const envelope = parseBillingWebhookEnvelope(validBody);
    expect(envelope).toEqual({
      id: "evt_1",
      type: "customer.subscription.updated",
      tenantId: "tenant_a",
      subscriptionId: "sub_1",
      status: "active",
      occurredAtIso: "2026-05-06T12:00:00.000Z",
    });
  });

  it("rejects invalid JSON", () => {
    expect(() => parseBillingWebhookEnvelope("{")).toThrow(
      BillingWebhookPayloadError,
    );
  });

  it("rejects unknown event type", () => {
    expect(() =>
      parseBillingWebhookEnvelope(
        JSON.stringify({
          id: "evt_1",
          type: "unknown.event",
          data: {
            tenantId: "t",
            subscriptionId: "s",
            status: "active",
            occurredAtIso: "2026-05-06T12:00:00.000Z",
          },
        }),
      ),
    ).toThrow(/event type/);
  });
});
