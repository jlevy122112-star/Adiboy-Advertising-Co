import type { CapabilityAuditEvent } from "./access-guard.js";

export type AccessAuditCallback = (event: CapabilityAuditEvent) => void;

export interface AccessAuditSink {
  record(event: CapabilityAuditEvent): void;
}

export class InMemoryAccessAuditSink implements AccessAuditSink {
  readonly events: CapabilityAuditEvent[] = [];

  record(event: CapabilityAuditEvent): void {
    this.events.push(event);
  }

  snapshot(): CapabilityAuditEvent[] {
    return [...this.events];
  }
}

export function toAccessAuditCallback(
  auditHandler?: AccessAuditSink | AccessAuditCallback,
): AccessAuditCallback | undefined {
  if (!auditHandler) {
    return undefined;
  }

  if (typeof auditHandler === "function") {
    return auditHandler;
  }

  return (event) => {
    auditHandler.record(event);
  };
}
