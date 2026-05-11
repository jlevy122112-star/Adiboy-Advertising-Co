import { describe, expect, test } from "vitest";

import type { AutonomousRunEvent } from "./autonomous-run-events.js";
import type {
  DecisionAuditEntry,
  DecisionAuditLog,
} from "./decision-audit-log.js";
import type { DecisionRecord } from "./decision-point.js";
import {
  buildDecisionTimeline,
  currentDecisionsForTarget,
  DecisionTimelineEntrySchema,
  DECISION_TIMELINE_SOURCES,
  DecisionTimelineSourceSchema,
  summarizeDecisionActivityForTarget,
} from "./decision-aggregator.js";

const T0 = "2026-05-11T06:00:00.000Z";
const T1 = "2026-05-11T06:01:00.000Z";
const T2 = "2026-05-11T06:02:00.000Z";
const T3 = "2026-05-11T06:03:00.000Z";

function record(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    recordId: "rec_1",
    decisionPointId: "copy.headline",
    workspaceId: "ws_1",
    actorUserId: "user_1",
    source: "user",
    committedAt: T0,
    chosenOptionId: "opt_a",
    value: "Original headline",
    ...overrides,
  };
}

function auditEntry(
  overrides: Partial<DecisionAuditEntry> = {},
): DecisionAuditEntry {
  const base: DecisionAuditEntry = {
    entryId: "entry_1",
    workspaceId: "ws_1",
    kind: "decision_committed",
    target: { kind: "brief", id: "brief_1", path: "copy.headline" },
    decisionPointId: "copy.headline",
    record: record(),
    alternativesOffered: [],
    supersedes: null,
    runId: null,
    briefId: "brief_1",
    scheduleEntryId: "sched_1",
    createdAt: T0,
    rationale: "",
  };
  return { ...base, ...overrides };
}

function runEvent(
  overrides: Partial<AutonomousRunEvent> = {},
): AutonomousRunEvent {
  return {
    eventId: "evt_1",
    runId: "run_1",
    occurredAt: T1,
    actorUserId: null,
    type: "decision_committed",
    decisionRecordId: "rec_2",
    decisionPointId: "copy.headline",
    source: "ai",
    controlMode: "ai_with_optional_override",
    committedAt: T1,
    ...overrides,
  } as AutonomousRunEvent;
}

describe("DECISION_TIMELINE_SOURCES", () => {
  test("exports the canonical source list", () => {
    expect(DECISION_TIMELINE_SOURCES).toEqual([
      "audit_log",
      "autonomous_run_event",
    ]);
    for (const source of DECISION_TIMELINE_SOURCES) {
      expect(DecisionTimelineSourceSchema.parse(source)).toBe(source);
    }
  });
});

describe("buildDecisionTimeline", () => {
  test("normalizes audit entries and decision-bearing run events in time order", () => {
    const timeline = buildDecisionTimeline({
      auditLog: [
        auditEntry({
          entryId: "entry_2",
          createdAt: T2,
          decisionPointId: "design.palette",
          record: record({
            recordId: "rec_3",
            decisionPointId: "design.palette",
            value: "blue",
          }),
        }),
        auditEntry(),
      ],
      runEvents: [
        runEvent(),
        runEvent({
          eventId: "evt_provider",
          type: "provider_result",
          network: "instagram",
          scheduleEntryId: "sched_1",
          ok: true,
          externalId: "ig_123",
          detail: null,
          attempt: 1,
        }),
      ],
    });

    expect(timeline.map((entry) => entry.timelineId)).toEqual([
      "audit_log:entry_1",
      "autonomous_run_event:evt_1",
      "audit_log:entry_2",
    ]);
    expect(timeline[0]?.record?.recordId).toBe("rec_1");
    expect(timeline[1]?.record).toBeNull();
    expect(timeline[1]?.recordId).toBe("rec_2");
    expect(timeline[2]?.auditEntryKind).toBe("decision_committed");
    for (const entry of timeline) {
      expect(DecisionTimelineEntrySchema.parse(entry)).toEqual(entry);
    }
  });

  test("normalizes autonomous user_override events with previous and new records", () => {
    const timeline = buildDecisionTimeline({
      runEvents: [
        {
          eventId: "evt_override",
          runId: "run_1",
          occurredAt: T1,
          actorUserId: "user_1",
          type: "user_override",
          decisionPointId: "copy.headline",
          previousRecordId: "rec_ai",
          newRecordId: "rec_user",
        },
      ],
    });

    expect(timeline).toHaveLength(1);
    expect(timeline[0]).toMatchObject({
      source: "autonomous_run_event",
      runEventType: "user_override",
      recordId: "rec_user",
      previousRecordId: "rec_ai",
      actorUserId: "user_1",
    });
  });

  test("filters by target, runId, briefId, scheduleEntryId, source, and decisionPointId", () => {
    const log: DecisionAuditLog = [
      auditEntry(),
      auditEntry({
        entryId: "entry_other_brief",
        target: { kind: "brief", id: "brief_2", path: "copy.headline" },
        briefId: "brief_2",
      }),
    ];
    const events: AutonomousRunEvent[] = [
      runEvent(),
      runEvent({
        eventId: "evt_other_run",
        runId: "run_2",
        decisionPointId: "design.palette",
        decisionRecordId: "rec_9",
      }),
    ];

    expect(
      buildDecisionTimeline({
        auditLog: log,
        runEvents: events,
        filter: { target: { kind: "brief", id: "brief_1" } },
      }).map((entry) => entry.timelineId),
    ).toEqual(["audit_log:entry_1"]);

    expect(
      buildDecisionTimeline({
        auditLog: log,
        runEvents: events,
        filter: { runId: "run_1" },
      }).map((entry) => entry.timelineId),
    ).toEqual(["autonomous_run_event:evt_1"]);

    expect(
      buildDecisionTimeline({
        auditLog: log,
        filter: { briefId: "brief_1", scheduleEntryId: "sched_1" },
      }).map((entry) => entry.timelineId),
    ).toEqual(["audit_log:entry_1"]);

    expect(
      buildDecisionTimeline({
        auditLog: log,
        runEvents: events,
        filter: {
          source: "autonomous_run_event",
          decisionPointId: "design.palette",
        },
      }).map((entry) => entry.timelineId),
    ).toEqual(["autonomous_run_event:evt_other_run"]);
  });

  test("breaks timestamp ties deterministically by timelineId", () => {
    const timeline = buildDecisionTimeline({
      auditLog: [
        auditEntry({ entryId: "z", createdAt: T0 }),
        auditEntry({ entryId: "a", createdAt: T0 }),
      ],
    });

    expect(timeline.map((entry) => entry.timelineId)).toEqual([
      "audit_log:a",
      "audit_log:z",
    ]);
  });
});

describe("currentDecisionsForTarget", () => {
  test("returns one current record-bearing entry per decision point", () => {
    const log: DecisionAuditLog = [
      auditEntry(),
      auditEntry({
        entryId: "entry_offer",
        kind: "ai_suggestion_offered",
        record: null,
        createdAt: T1,
      }),
      auditEntry({
        entryId: "entry_2",
        kind: "user_override",
        record: record({
          recordId: "rec_2",
          value: "Edited headline",
          replacesRecordId: "rec_1",
        }),
        supersedes: { entryId: "entry_1", reason: "user_edit" },
        createdAt: T2,
      }),
      auditEntry({
        entryId: "entry_palette",
        decisionPointId: "design.palette",
        target: { kind: "brief", id: "brief_1", path: "design.palette" },
        record: record({
          recordId: "rec_palette",
          decisionPointId: "design.palette",
          value: "brand_primary",
        }),
        createdAt: T3,
      }),
    ];

    const current = currentDecisionsForTarget({
      auditLog: log,
      target: { kind: "brief", id: "brief_1" },
    });

    expect(current.map((entry) => entry.entryId)).toEqual([
      "entry_2",
      "entry_palette",
    ]);
  });

  test("ignores other targets", () => {
    const current = currentDecisionsForTarget({
      auditLog: [
        auditEntry(),
        auditEntry({
          entryId: "entry_other",
          target: { kind: "campaign", id: "campaign_1", path: "" },
        }),
      ],
      target: { kind: "campaign", id: "campaign_1" },
    });

    expect(current.map((entry) => entry.entryId)).toEqual(["entry_other"]);
  });
});

describe("summarizeDecisionActivityForTarget", () => {
  test("returns target-scoped timeline, current heads, and latest activity time", () => {
    const summary = summarizeDecisionActivityForTarget({
      auditLog: [
        auditEntry(),
        auditEntry({
          entryId: "entry_2",
          kind: "user_override",
          record: record({
            recordId: "rec_2",
            value: "Edited headline",
            replacesRecordId: "rec_1",
          }),
          supersedes: { entryId: "entry_1", reason: "user_edit" },
          createdAt: T2,
        }),
      ],
      runEvents: [runEvent()],
      target: { kind: "brief", id: "brief_1" },
    });

    expect(summary.timeline.map((entry) => entry.timelineId)).toEqual([
      "audit_log:entry_1",
      "audit_log:entry_2",
    ]);
    expect(summary.currentDecisions.map((entry) => entry.entryId)).toEqual([
      "entry_2",
    ]);
    expect(summary.latestActivityAt).toBe(T2);
  });

  test("returns null latestActivityAt when the target has no activity", () => {
    const summary = summarizeDecisionActivityForTarget({
      auditLog: [auditEntry()],
      runEvents: [runEvent()],
      target: { kind: "asset", id: "asset_missing" },
    });

    expect(summary.timeline).toEqual([]);
    expect(summary.currentDecisions).toEqual([]);
    expect(summary.latestActivityAt).toBeNull();
  });
});
