import { describe, expect, test } from "vitest";

import {
  AUTONOMOUS_RUN_EVENT_TYPES,
  AutonomousRunEventSchema,
  AutonomousRunEventTypeSchema,
  CancelRequestedEventSchema,
  DecisionCommittedEventSchema,
  ErrorEventSchema,
  EVENT_SCHEMAS_BY_TYPE,
  eventCausesStateChange,
  eventToTargetState,
  isAuditOnlyEvent,
  NotificationSentEventSchema,
  PauseRequestedEventSchema,
  ProviderResultEventSchema,
  ResumeRequestedEventSchema,
  StateChangeEventSchema,
  TimeoutEventSchema,
  UserOverrideEventSchema,
  type AutonomousRunEvent,
  type AutonomousRunEventType,
} from "./autonomous-run-events.js";
import {
  AUTONOMOUS_RUN_STATES,
  type AutonomousRunState,
} from "./autonomous-run-state.js";

const NOW = "2026-05-10T18:00:00.000Z";
const STARTED = "2026-05-10T17:00:00.000Z";

const baseFields = {
  eventId: "evt_001",
  runId: "run_001",
  occurredAt: NOW,
  actorUserId: null as string | null,
};

describe("AutonomousRunEventTypeSchema", () => {
  test("accepts every canonical type", () => {
    for (const t of AUTONOMOUS_RUN_EVENT_TYPES) {
      expect(AutonomousRunEventTypeSchema.parse(t)).toBe(t);
    }
  });

  test("AUTONOMOUS_RUN_EVENT_TYPES has 10 entries", () => {
    expect(AUTONOMOUS_RUN_EVENT_TYPES).toHaveLength(10);
  });

  test("rejects unknown types", () => {
    expect(() => AutonomousRunEventTypeSchema.parse("unknown")).toThrow();
  });
});

describe("StateChangeEventSchema", () => {
  test("accepts a well-formed state change", () => {
    const event = {
      ...baseFields,
      type: "state_change" as const,
      fromState: "planning" as const,
      toState: "generating" as const,
      failureKind: null,
    };
    expect(StateChangeEventSchema.parse(event)).toEqual(event);
  });

  test("requires failureKind when toState is failed", () => {
    expect(() =>
      StateChangeEventSchema.parse({
        ...baseFields,
        type: "state_change",
        fromState: "publishing",
        toState: "failed",
        failureKind: null,
      }),
    ).toThrow();

    const event = {
      ...baseFields,
      type: "state_change" as const,
      fromState: "publishing" as const,
      toState: "failed" as const,
      failureKind: "publishing_failed" as const,
    };
    expect(StateChangeEventSchema.parse(event)).toEqual(event);
  });

  test("rejects self-transition", () => {
    expect(() =>
      StateChangeEventSchema.parse({
        ...baseFields,
        type: "state_change",
        fromState: "planning",
        toState: "planning",
        failureKind: null,
      }),
    ).toThrow();
  });

  test("accepts optional reason up to 500 chars", () => {
    const event = {
      ...baseFields,
      type: "state_change" as const,
      fromState: "validating" as const,
      toState: "planning" as const,
      reason: "preconditions ok",
      failureKind: null,
    };
    expect(StateChangeEventSchema.parse(event)).toMatchObject(event);
  });

  test("rejects unknown extra fields (strict)", () => {
    expect(() =>
      StateChangeEventSchema.parse({
        ...baseFields,
        type: "state_change",
        fromState: "validating",
        toState: "planning",
        failureKind: null,
        extra: 1,
      }),
    ).toThrow();
  });
});

describe("DecisionCommittedEventSchema", () => {
  test("accepts a well-formed event", () => {
    const event = {
      ...baseFields,
      type: "decision_committed" as const,
      decisionRecordId: "rec_001",
      decisionPointId: "schedule.dates",
      source: "ai" as const,
      controlMode: "ai_with_optional_override" as const,
      committedAt: NOW,
    };
    expect(DecisionCommittedEventSchema.parse(event)).toEqual(event);
  });

  test("rejects bad source", () => {
    expect(() =>
      DecisionCommittedEventSchema.parse({
        ...baseFields,
        type: "decision_committed",
        decisionRecordId: "rec_001",
        decisionPointId: "schedule.dates",
        source: "magic",
        controlMode: "ai_with_optional_override",
        committedAt: NOW,
      }),
    ).toThrow();
  });
});

describe("ProviderResultEventSchema", () => {
  test("accepts a successful publish result", () => {
    const event = {
      ...baseFields,
      type: "provider_result" as const,
      network: "instagram" as const,
      scheduleEntryId: "se_001",
      ok: true,
      externalId: "ig_post_42",
      detail: null as string | null,
      attempt: 1,
    };
    expect(ProviderResultEventSchema.parse(event)).toEqual(event);
  });

  test("accepts a failed result with detail and retry hint", () => {
    const event = {
      ...baseFields,
      type: "provider_result" as const,
      network: "x" as const,
      scheduleEntryId: "se_002",
      ok: false,
      externalId: null as string | null,
      detail: "rate limited",
      attempt: 3,
      nextRetryAfterMs: 60_000,
    };
    expect(ProviderResultEventSchema.parse(event)).toEqual(event);
  });

  test("rejects attempt < 1 or > 20", () => {
    const baseProvider = {
      ...baseFields,
      type: "provider_result" as const,
      network: "x" as const,
      scheduleEntryId: "se",
      ok: true,
      externalId: "id",
      detail: null,
    };
    expect(() =>
      ProviderResultEventSchema.parse({ ...baseProvider, attempt: 0 }),
    ).toThrow();
    expect(() =>
      ProviderResultEventSchema.parse({ ...baseProvider, attempt: 21 }),
    ).toThrow();
  });

  test("rejects nextRetryAfterMs above 24 h", () => {
    expect(() =>
      ProviderResultEventSchema.parse({
        ...baseFields,
        type: "provider_result",
        network: "x",
        scheduleEntryId: "se",
        ok: false,
        externalId: null,
        detail: "x",
        attempt: 1,
        nextRetryAfterMs: 86_400_001,
      }),
    ).toThrow();
  });
});

describe("UserOverrideEventSchema", () => {
  test("accepts a well-formed override", () => {
    const event = {
      ...baseFields,
      actorUserId: "user_007",
      type: "user_override" as const,
      decisionPointId: "schedule.dates",
      previousRecordId: "rec_old",
      newRecordId: "rec_new",
    };
    expect(UserOverrideEventSchema.parse(event)).toEqual(event);
  });
});

describe("TimeoutEventSchema", () => {
  test("accepts a well-formed timeout", () => {
    const event = {
      ...baseFields,
      type: "timeout" as const,
      state: "generating" as const,
      enteredAt: STARTED,
      expectedTimeoutMs: 30 * 60_000,
    };
    expect(TimeoutEventSchema.parse(event)).toEqual(event);
  });

  test("rejects expectedTimeoutMs below 1", () => {
    expect(() =>
      TimeoutEventSchema.parse({
        ...baseFields,
        type: "timeout",
        state: "planning",
        enteredAt: STARTED,
        expectedTimeoutMs: 0,
      }),
    ).toThrow();
  });
});

describe("ErrorEventSchema", () => {
  test("accepts a recoverable error with null failureKind", () => {
    const event = {
      ...baseFields,
      type: "error" as const,
      errorCode: "transient_io",
      message: "DNS hiccup",
      recoverable: true,
      failureKind: null,
    };
    expect(ErrorEventSchema.parse(event)).toEqual(event);
  });

  test("requires failureKind when not recoverable", () => {
    expect(() =>
      ErrorEventSchema.parse({
        ...baseFields,
        type: "error",
        errorCode: "fatal",
        message: "panic",
        recoverable: false,
        failureKind: null,
      }),
    ).toThrow();

    const event = {
      ...baseFields,
      type: "error" as const,
      errorCode: "fatal",
      message: "panic",
      recoverable: false,
      failureKind: "internal_error" as const,
    };
    expect(ErrorEventSchema.parse(event)).toEqual(event);
  });
});

describe("CancelRequestedEventSchema + Pause/Resume", () => {
  test("accepts cancel with optional reason", () => {
    const event = {
      ...baseFields,
      actorUserId: "user_007",
      type: "cancel_requested" as const,
      reason: "wrong campaign",
    };
    expect(CancelRequestedEventSchema.parse(event)).toEqual(event);
  });

  test("accepts pause without reason", () => {
    const event = {
      ...baseFields,
      actorUserId: "user_007",
      type: "pause_requested" as const,
    };
    expect(PauseRequestedEventSchema.parse(event)).toMatchObject(event);
  });

  test("accepts resume without payload", () => {
    const event = {
      ...baseFields,
      actorUserId: "user_007",
      type: "resume_requested" as const,
    };
    expect(ResumeRequestedEventSchema.parse(event)).toEqual(event);
  });
});

describe("NotificationSentEventSchema", () => {
  test("accepts a well-formed event with sha256 digest", () => {
    const event = {
      ...baseFields,
      type: "notification_sent" as const,
      reason: "first_publish_per_post" as const,
      channels: ["in_app", "email"] as ("in_app" | "email")[],
      payloadDigest:
        "abc123def456abc123def456abc123def456abc123def456abc123def456abcd",
    };
    expect(NotificationSentEventSchema.parse(event)).toEqual(event);
  });

  test("rejects malformed digest", () => {
    expect(() =>
      NotificationSentEventSchema.parse({
        ...baseFields,
        type: "notification_sent",
        reason: "first_publish_per_post",
        channels: ["in_app"],
        payloadDigest: "not-a-sha",
      }),
    ).toThrow();
  });

  test("rejects empty channel array", () => {
    expect(() =>
      NotificationSentEventSchema.parse({
        ...baseFields,
        type: "notification_sent",
        reason: "first_publish_per_post",
        channels: [],
      }),
    ).toThrow();
  });
});

describe("AutonomousRunEventSchema (union)", () => {
  test("accepts every event variant", () => {
    const variants: AutonomousRunEvent[] = [
      {
        ...baseFields,
        type: "state_change",
        fromState: "planning",
        toState: "generating",
        failureKind: null,
      },
      {
        ...baseFields,
        type: "decision_committed",
        decisionRecordId: "r",
        decisionPointId: "schedule.dates",
        source: "ai",
        controlMode: "ai_with_optional_override",
        committedAt: NOW,
      },
      {
        ...baseFields,
        type: "provider_result",
        network: "x",
        scheduleEntryId: "se",
        ok: true,
        externalId: "id",
        detail: null,
        attempt: 1,
      },
      {
        ...baseFields,
        type: "user_override",
        decisionPointId: "schedule.dates",
        previousRecordId: "old",
        newRecordId: "new",
      },
      {
        ...baseFields,
        type: "timeout",
        state: "generating",
        enteredAt: STARTED,
        expectedTimeoutMs: 60_000,
      },
      {
        ...baseFields,
        type: "error",
        errorCode: "io",
        message: "x",
        recoverable: true,
        failureKind: null,
      },
      { ...baseFields, type: "cancel_requested" },
      { ...baseFields, type: "pause_requested" },
      { ...baseFields, type: "resume_requested" },
      {
        ...baseFields,
        type: "notification_sent",
        reason: "first_publish_per_post",
        channels: ["in_app"],
      },
    ];
    for (const ev of variants) {
      expect(AutonomousRunEventSchema.parse(ev)).toEqual(ev);
    }
  });

  test("rejects an event with an unknown type tag", () => {
    expect(() =>
      AutonomousRunEventSchema.parse({
        ...baseFields,
        type: "boom",
      }),
    ).toThrow();
  });
});

describe("eventToTargetState", () => {
  test("state_change always proposes the carried toState", () => {
    const ev: AutonomousRunEvent = {
      ...baseFields,
      type: "state_change",
      fromState: "planning",
      toState: "generating",
      failureKind: null,
    };
    expect(eventToTargetState(ev, "planning")).toBe("generating");
  });

  test("cancel_requested → cancelled from any non-terminal state", () => {
    const ev: AutonomousRunEvent = { ...baseFields, type: "cancel_requested" };
    for (const state of AUTONOMOUS_RUN_STATES) {
      const expected = ["completed", "failed", "cancelled"].includes(state)
        ? null
        : "cancelled";
      expect(
        eventToTargetState(ev, state as AutonomousRunState),
        `cancel_requested from ${state}`,
      ).toBe(expected);
    }
  });

  test("pause_requested → paused only from active states", () => {
    const ev: AutonomousRunEvent = { ...baseFields, type: "pause_requested" };
    expect(eventToTargetState(ev, "planning")).toBe("paused");
    expect(eventToTargetState(ev, "publishing")).toBe("paused");
    expect(eventToTargetState(ev, "awaiting_user")).toBe(null);
    expect(eventToTargetState(ev, "paused")).toBe(null);
    expect(eventToTargetState(ev, "completed")).toBe(null);
  });

  test("resume_requested always returns null (composite reducer handles target)", () => {
    const ev: AutonomousRunEvent = { ...baseFields, type: "resume_requested" };
    for (const state of AUTONOMOUS_RUN_STATES) {
      expect(eventToTargetState(ev, state as AutonomousRunState)).toBe(null);
    }
  });

  test("timeout → failed from any non-terminal state", () => {
    const ev: AutonomousRunEvent = {
      ...baseFields,
      type: "timeout",
      state: "generating",
      enteredAt: STARTED,
      expectedTimeoutMs: 60_000,
    };
    expect(eventToTargetState(ev, "generating")).toBe("failed");
    expect(eventToTargetState(ev, "publishing")).toBe("failed");
    expect(eventToTargetState(ev, "completed")).toBe(null);
  });

  test("error recoverable=true → null; recoverable=false → failed", () => {
    const recover: AutonomousRunEvent = {
      ...baseFields,
      type: "error",
      errorCode: "x",
      message: "x",
      recoverable: true,
      failureKind: null,
    };
    expect(eventToTargetState(recover, "generating")).toBe(null);

    const fatal: AutonomousRunEvent = {
      ...baseFields,
      type: "error",
      errorCode: "x",
      message: "x",
      recoverable: false,
      failureKind: "internal_error",
    };
    expect(eventToTargetState(fatal, "generating")).toBe("failed");
    expect(eventToTargetState(fatal, "completed")).toBe(null);
  });

  test("audit-only events never drive a state change", () => {
    const auditOnly: AutonomousRunEvent[] = [
      {
        ...baseFields,
        type: "decision_committed",
        decisionRecordId: "r",
        decisionPointId: "p",
        source: "ai",
        controlMode: "ai_with_optional_override",
        committedAt: NOW,
      },
      {
        ...baseFields,
        type: "user_override",
        decisionPointId: "p",
        previousRecordId: "a",
        newRecordId: "b",
      },
      {
        ...baseFields,
        type: "provider_result",
        network: "x",
        scheduleEntryId: "se",
        ok: true,
        externalId: "id",
        detail: null,
        attempt: 1,
      },
      {
        ...baseFields,
        type: "notification_sent",
        reason: "first_publish_per_post",
        channels: ["in_app"],
      },
    ];
    for (const ev of auditOnly) {
      for (const state of AUTONOMOUS_RUN_STATES) {
        expect(
          eventToTargetState(ev, state as AutonomousRunState),
          `${ev.type} from ${state}`,
        ).toBe(null);
      }
    }
  });

  test("any event from a terminal state returns null", () => {
    const events: AutonomousRunEvent[] = [
      { ...baseFields, type: "cancel_requested" },
      { ...baseFields, type: "pause_requested" },
      {
        ...baseFields,
        type: "state_change",
        fromState: "publishing",
        toState: "completed",
        failureKind: null,
      },
    ];
    for (const ev of events) {
      expect(eventToTargetState(ev, "completed")).toBe(null);
      expect(eventToTargetState(ev, "failed")).toBe(null);
      expect(eventToTargetState(ev, "cancelled")).toBe(null);
    }
  });
});

describe("eventCausesStateChange + isAuditOnlyEvent", () => {
  test("eventCausesStateChange mirrors eventToTargetState !== null", () => {
    const ev: AutonomousRunEvent = { ...baseFields, type: "cancel_requested" };
    expect(eventCausesStateChange(ev, "planning")).toBe(true);
    expect(eventCausesStateChange(ev, "completed")).toBe(false);
  });

  test("isAuditOnlyEvent classifies the four audit-only types", () => {
    // Audit-only = NEVER causes a state transition under any circumstance,
    // including via the composite reducer in autonomous-run.ts. Note that
    // `resume_requested` is intentionally excluded — see the next test.
    const auditTypes: AutonomousRunEventType[] = [
      "decision_committed",
      "user_override",
      "provider_result",
      "notification_sent",
    ];
    expect(auditTypes).toHaveLength(4);
    for (const type of auditTypes) {
      const ev = { ...baseFields, type } as AutonomousRunEvent;
      expect(isAuditOnlyEvent(ev), `${type} should be audit-only`).toBe(true);
    }
  });

  test("isAuditOnlyEvent returns false for resume_requested (composite reducer synthesizes a state_change from blocking states)", () => {
    const ev: AutonomousRunEvent = {
      ...baseFields,
      type: "resume_requested",
    };
    expect(isAuditOnlyEvent(ev)).toBe(false);
  });

  test("isAuditOnlyEvent returns false for transition-driving events", () => {
    const driving: AutonomousRunEvent[] = [
      {
        ...baseFields,
        type: "state_change",
        fromState: "planning",
        toState: "generating",
        failureKind: null,
      },
      { ...baseFields, type: "cancel_requested" },
      { ...baseFields, type: "pause_requested" },
      {
        ...baseFields,
        type: "timeout",
        state: "generating",
        enteredAt: STARTED,
        expectedTimeoutMs: 60_000,
      },
      {
        ...baseFields,
        type: "error",
        errorCode: "x",
        message: "x",
        recoverable: false,
        failureKind: "internal_error",
      },
    ];
    for (const ev of driving) {
      expect(isAuditOnlyEvent(ev)).toBe(false);
    }
  });
});

describe("EVENT_SCHEMAS_BY_TYPE", () => {
  test("has an entry for every event type", () => {
    for (const type of AUTONOMOUS_RUN_EVENT_TYPES) {
      expect(EVENT_SCHEMAS_BY_TYPE).toHaveProperty(type);
    }
  });

  test("entry for state_change refines failed-without-failureKind", () => {
    expect(() =>
      EVENT_SCHEMAS_BY_TYPE.state_change.parse({
        ...baseFields,
        type: "state_change",
        fromState: "publishing",
        toState: "failed",
        failureKind: null,
      }),
    ).toThrow();
  });
});
