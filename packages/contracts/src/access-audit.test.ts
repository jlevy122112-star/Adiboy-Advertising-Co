import { describe, expect, it, vi } from "vitest";
import type { CapabilityAuditEvent } from "./access-guard.js";
import {
  InMemoryAccessAuditSink,
  toAccessAuditCallback,
} from "./access-audit.js";

describe("InMemoryAccessAuditSink", () => {
  it("records and snapshots events", () => {
    const sink = new InMemoryAccessAuditSink();
    const event = {
      eventType: "auth.capability_check" as const,
      occurredAt: "2026-05-06T00:00:00.000Z",
      requestId: "r1",
      tenantId: "t1" as import("./tenant-context.js").TenantId,
      actorUserId: "u1" as import("./tenant-context.js").UserId,
      actorRole: "tenant_admin" as const,
      capability: "tenant.read" as const,
      outcome: "allowed" as const,
      reason: null,
    } satisfies CapabilityAuditEvent;

    sink.record(event);
    const snap = sink.snapshot();
    expect(snap).toHaveLength(1);
    expect(snap[0]).toEqual(event);
    expect(sink.snapshot()).not.toBe(snap);
  });
});

describe("toAccessAuditCallback", () => {
  it("returns undefined when handler is missing", () => {
    expect(toAccessAuditCallback(undefined)).toBeUndefined();
  });

  it("passes through a function handler", () => {
    const fn = vi.fn();
    expect(toAccessAuditCallback(fn)).toBe(fn);
  });

  it("wraps a sink with record()", () => {
    const sink = new InMemoryAccessAuditSink();
    const cb = toAccessAuditCallback(sink);
    expect(cb).toBeDefined();

    const event = {
      eventType: "auth.capability_check" as const,
      occurredAt: "2026-05-06T00:00:00.000Z",
      requestId: "r2",
      tenantId: "t1" as import("./tenant-context.js").TenantId,
      actorUserId: "u1" as import("./tenant-context.js").UserId,
      actorRole: "tenant_admin" as const,
      capability: "tenant.read" as const,
      outcome: "denied" as const,
      reason: "missing_capability" as const,
    } satisfies CapabilityAuditEvent;

    cb?.(event);
    expect(sink.snapshot()).toEqual([event]);
  });
});
