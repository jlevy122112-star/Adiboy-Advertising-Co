/**
 * Unit tests for `decision-audit-log.ts`. Exercises:
 *   - the kind/target/supersede-reason vocabularies
 *   - DecisionAuditEntrySchema refinements (record-required kinds,
 *     supersede coupling, autonomous_override constraints)
 *   - createAuditEntry factory defaults + validation
 *   - appendAuditEntry invariants (uniqueness, monotonic time,
 *     supersede target existence, workspace coherence)
 *   - validateAuditEntryAgainstPoint (user-only invariant)
 *   - projections (findCurrentDecision, decisionTrailFor,
 *     auditEntriesForRun/Brief/ScheduleEntry)
 *   - predicates (wasOverriddenByUser, isHeadDecisionAutonomous,
 *     supersedeReasonOf)
 *   - read helpers
 */

import { describe, expect, test } from "vitest";

import type {
  DecisionPoint,
  DecisionRecord,
} from "./decision-point.js";

import {
  appendAuditEntry,
  auditEntriesForBrief,
  auditEntriesForRun,
  auditEntriesForScheduleEntry,
  AUDIT_ENTRY_KINDS,
  AUDIT_SUPERSEDE_REASONS,
  AUDIT_TARGET_KINDS,
  AuditAlternativeSchema,
  AuditEntryKindSchema,
  AuditSupersedeReasonSchema,
  AuditTargetKindSchema,
  AuditTargetSchema,
  createAuditEntry,
  DecisionAuditEntrySchema,
  decisionTrailFor,
  entryKindRequiresRecord,
  findCurrentDecision,
  isHeadDecisionAutonomous,
  listAuditEntryKinds,
  listAuditSupersedeReasons,
  listAuditTargetKinds,
  supersedeReasonOf,
  validateAuditEntryAgainstPoint,
  wasOverriddenByUser,
  type AuditEntryKind,
  type AuditSupersedeReason,
  type AuditTargetKind,
  type DecisionAuditEntry,
  type DecisionAuditLog,
} from "./decision-audit-log.js";

/* -------------------------------------------------------------------------- */
/*                              Test fixtures                                 */
/* -------------------------------------------------------------------------- */

const T0 = "2026-05-11T05:00:00.000Z";
const T1 = "2026-05-11T05:01:00.000Z";
const T2 = "2026-05-11T05:02:00.000Z";
const T3 = "2026-05-11T05:03:00.000Z";

function buildRecord(
  overrides: Partial<DecisionRecord> = {},
): DecisionRecord {
  return {
    recordId: "rec_1",
    decisionPointId: "point.x",
    workspaceId: "ws_1",
    actorUserId: "user_1",
    source: "user",
    committedAt: T0,
    chosenOptionId: "opt_a",
    value: "value-a",
    ...overrides,
  };
}

function buildEntry(
  overrides: Partial<DecisionAuditEntry> = {},
): DecisionAuditEntry {
  const base: DecisionAuditEntry = {
    entryId: "entry_1",
    workspaceId: "ws_1",
    kind: "decision_committed",
    target: { kind: "brief", id: "brief_1", path: "" },
    decisionPointId: "point.x",
    record: buildRecord(),
    alternativesOffered: [],
    supersedes: null,
    runId: null,
    briefId: "brief_1",
    scheduleEntryId: null,
    createdAt: T0,
    rationale: "",
  };
  return { ...base, ...overrides };
}

/* -------------------------------------------------------------------------- */
/*                                  Vocabs                                    */
/* -------------------------------------------------------------------------- */

describe("AUDIT_ENTRY_KINDS + AUDIT_TARGET_KINDS + AUDIT_SUPERSEDE_REASONS", () => {
  test("AUDIT_ENTRY_KINDS is the canonical six-kind list", () => {
    expect(AUDIT_ENTRY_KINDS).toEqual([
      "decision_committed",
      "decision_superseded",
      "ai_suggestion_offered",
      "ai_suggestion_rejected",
      "autonomous_override",
      "user_override",
    ]);
  });

  test("AUDIT_TARGET_KINDS covers the canonical six target kinds", () => {
    expect(AUDIT_TARGET_KINDS).toEqual([
      "workspace",
      "campaign",
      "schedule_entry",
      "brief",
      "asset",
      "run",
    ]);
  });

  test("AUDIT_SUPERSEDE_REASONS covers the canonical six reasons", () => {
    expect(AUDIT_SUPERSEDE_REASONS).toEqual([
      "user_edit",
      "ai_regenerate",
      "autonomous_override",
      "validation_failure",
      "policy_change",
      "rollback",
    ]);
  });

  test("schemas accept exactly their canonical sets", () => {
    for (const k of AUDIT_ENTRY_KINDS) {
      expect(AuditEntryKindSchema.parse(k)).toBe(k);
    }
    for (const k of AUDIT_TARGET_KINDS) {
      expect(AuditTargetKindSchema.parse(k)).toBe(k);
    }
    for (const r of AUDIT_SUPERSEDE_REASONS) {
      expect(AuditSupersedeReasonSchema.parse(r)).toBe(r);
    }
    expect(() => AuditEntryKindSchema.parse("nope")).toThrow();
  });
});

describe("entryKindRequiresRecord", () => {
  test("returns true for record-bearing kinds", () => {
    const requires: AuditEntryKind[] = [
      "decision_committed",
      "decision_superseded",
      "autonomous_override",
      "user_override",
    ];
    for (const k of requires) {
      expect(entryKindRequiresRecord(k)).toBe(true);
    }
  });

  test("returns false for offer/reject kinds", () => {
    expect(entryKindRequiresRecord("ai_suggestion_offered")).toBe(false);
    expect(entryKindRequiresRecord("ai_suggestion_rejected")).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/*                              AuditTargetSchema                             */
/* -------------------------------------------------------------------------- */

describe("AuditTargetSchema", () => {
  test("accepts a minimal target (path defaults to empty)", () => {
    const t = AuditTargetSchema.parse({ kind: "brief", id: "brief_1" });
    expect(t.path).toBe("");
  });

  test("accepts a target with a dotted path", () => {
    const t = AuditTargetSchema.parse({
      kind: "brief",
      id: "brief_1",
      path: "copy.headline",
    });
    expect(t.path).toBe("copy.headline");
  });

  test("rejects unknown extra keys (strict)", () => {
    expect(() =>
      AuditTargetSchema.parse({
        kind: "brief",
        id: "brief_1",
        rogue: 1,
      }),
    ).toThrow();
  });

  test("rejects an empty target id", () => {
    expect(() => AuditTargetSchema.parse({ kind: "brief", id: "" })).toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/*                          AuditAlternativeSchema                            */
/* -------------------------------------------------------------------------- */

describe("AuditAlternativeSchema", () => {
  test("accepts a minimal alternative", () => {
    expect(
      AuditAlternativeSchema.parse({ optionId: "opt_a", source: "ai" }),
    ).toEqual({ optionId: "opt_a", source: "ai" });
  });

  test("accepts confidence in [0,1]", () => {
    expect(
      AuditAlternativeSchema.parse({
        optionId: "opt_a",
        source: "ai",
        confidence: 0.7,
      }).confidence,
    ).toBe(0.7);
  });

  test("rejects confidence > 1", () => {
    expect(() =>
      AuditAlternativeSchema.parse({
        optionId: "opt_a",
        source: "ai",
        confidence: 1.1,
      }),
    ).toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/*                        DecisionAuditEntrySchema                            */
/* -------------------------------------------------------------------------- */

describe("DecisionAuditEntrySchema (refinements)", () => {
  test("accepts a complete decision_committed entry", () => {
    const e = buildEntry();
    expect(DecisionAuditEntrySchema.parse(e)).toEqual(e);
  });

  test("rejects decision_committed entry with record=null", () => {
    expect(() =>
      DecisionAuditEntrySchema.parse(buildEntry({ record: null })),
    ).toThrow(/record is required/);
  });

  test("accepts ai_suggestion_offered with record=null", () => {
    const e = buildEntry({
      kind: "ai_suggestion_offered",
      record: null,
      alternativesOffered: [
        { optionId: "opt_a", source: "ai" },
        { optionId: "opt_b", source: "ai" },
      ],
    });
    expect(DecisionAuditEntrySchema.parse(e)).toEqual(e);
  });

  test("rejects ai_suggestion_offered with a record set", () => {
    expect(() =>
      DecisionAuditEntrySchema.parse(
        buildEntry({ kind: "ai_suggestion_offered" }),
      ),
    ).toThrow(/forbidden otherwise/);
  });

  test("requires supersedes when kind is decision_superseded", () => {
    expect(() =>
      DecisionAuditEntrySchema.parse(
        buildEntry({ kind: "decision_superseded" }),
      ),
    ).toThrow(/supersedes/);
  });

  test("accepts decision_superseded with a complete supersedes block", () => {
    const e = buildEntry({
      kind: "decision_superseded",
      supersedes: { entryId: "entry_0", reason: "user_edit" },
    });
    expect(DecisionAuditEntrySchema.parse(e)).toEqual(e);
  });

  test("rejects supersedes set on non-supersede non-user_override kinds", () => {
    expect(() =>
      DecisionAuditEntrySchema.parse(
        buildEntry({
          kind: "decision_committed",
          supersedes: { entryId: "entry_0", reason: "user_edit" },
        }),
      ),
    ).toThrow(/supersedes/);
  });

  test("allows supersedes on user_override (optional)", () => {
    const e = buildEntry({
      kind: "user_override",
      supersedes: { entryId: "entry_0", reason: "user_edit" },
    });
    expect(DecisionAuditEntrySchema.parse(e)).toEqual(e);
  });

  test("rejects autonomous_override missing runId", () => {
    expect(() =>
      DecisionAuditEntrySchema.parse(
        buildEntry({
          kind: "autonomous_override",
          record: buildRecord({ source: "ai" }),
          runId: null,
        }),
      ),
    ).toThrow(/autonomous_override/);
  });

  test("rejects autonomous_override with source='user' on the record", () => {
    expect(() =>
      DecisionAuditEntrySchema.parse(
        buildEntry({
          kind: "autonomous_override",
          record: buildRecord({ source: "user" }),
          runId: "run_1",
        }),
      ),
    ).toThrow(/autonomous_override/);
  });

  test("accepts a valid autonomous_override", () => {
    const e = buildEntry({
      kind: "autonomous_override",
      record: buildRecord({ source: "ai" }),
      runId: "run_1",
    });
    expect(DecisionAuditEntrySchema.parse(e)).toEqual(e);
  });

  test("rejects unknown extra keys (strict)", () => {
    expect(() =>
      DecisionAuditEntrySchema.parse({ ...buildEntry(), rogue: 1 }),
    ).toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/*                            createAuditEntry                                */
/* -------------------------------------------------------------------------- */

describe("createAuditEntry", () => {
  test("fills defaults for optional fields", () => {
    const e = createAuditEntry({
      entryId: "entry_1",
      workspaceId: "ws_1",
      kind: "decision_committed",
      target: { kind: "brief", id: "brief_1", path: "" },
      decisionPointId: "point.x",
      record: buildRecord(),
      createdAt: T0,
    });
    expect(e.alternativesOffered).toEqual([]);
    expect(e.supersedes).toBeNull();
    expect(e.runId).toBeNull();
    expect(e.scheduleEntryId).toBeNull();
    expect(e.rationale).toBe("");
  });

  test("preserves the briefId passed in args", () => {
    const e = createAuditEntry({
      entryId: "entry_1",
      workspaceId: "ws_1",
      kind: "decision_committed",
      target: { kind: "brief", id: "brief_1", path: "" },
      decisionPointId: "point.x",
      record: buildRecord(),
      briefId: "brief_xyz",
      createdAt: T0,
    });
    expect(e.briefId).toBe("brief_xyz");
  });

  test("throws when the resulting entry fails refinement", () => {
    expect(() =>
      createAuditEntry({
        entryId: "entry_1",
        workspaceId: "ws_1",
        kind: "decision_committed",
        target: { kind: "brief", id: "brief_1", path: "" },
        decisionPointId: "point.x",
        // record omitted — should throw
        createdAt: T0,
      }),
    ).toThrow(/record is required/);
  });
});

/* -------------------------------------------------------------------------- */
/*                             appendAuditEntry                               */
/* -------------------------------------------------------------------------- */

describe("appendAuditEntry", () => {
  test("appends to an empty log", () => {
    const e = buildEntry();
    const r = appendAuditEntry([], e);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.log).toEqual([e]);
  });

  test("rejects duplicate entryId", () => {
    const e1 = buildEntry({ entryId: "entry_1", createdAt: T0 });
    const e2 = buildEntry({ entryId: "entry_1", createdAt: T1 });
    const log: DecisionAuditLog = [e1];
    const r = appendAuditEntry(log, e2);
    expect(r).toEqual({ ok: false, reason: "duplicate_entry_id" });
  });

  test("rejects non-monotonic createdAt", () => {
    const e1 = buildEntry({ entryId: "entry_1", createdAt: T2 });
    const e2 = buildEntry({ entryId: "entry_2", createdAt: T1 });
    const r = appendAuditEntry([e1], e2);
    expect(r).toEqual({ ok: false, reason: "createdAt_not_monotonic" });
  });

  test("allows equal createdAt (>=)", () => {
    const e1 = buildEntry({ entryId: "entry_1", createdAt: T1 });
    const e2 = buildEntry({ entryId: "entry_2", createdAt: T1 });
    const r = appendAuditEntry([e1], e2);
    expect(r.ok).toBe(true);
  });

  test("rejects mismatched workspaceId", () => {
    const e1 = buildEntry({ entryId: "entry_1", workspaceId: "ws_1" });
    const e2 = buildEntry({
      entryId: "entry_2",
      workspaceId: "ws_2",
      createdAt: T1,
    });
    const r = appendAuditEntry([e1], e2);
    expect(r).toEqual({ ok: false, reason: "workspace_mismatch" });
  });

  test("rejects supersede pointing at an unknown entryId", () => {
    const e1 = buildEntry({ entryId: "entry_1", createdAt: T0 });
    const e2 = buildEntry({
      entryId: "entry_2",
      kind: "decision_superseded",
      supersedes: { entryId: "entry_ghost", reason: "user_edit" },
      createdAt: T1,
    });
    const r = appendAuditEntry([e1], e2);
    expect(r).toEqual({ ok: false, reason: "supersedes_unknown_entry" });
  });

  test("accepts supersede pointing at an existing entry", () => {
    const e1 = buildEntry({ entryId: "entry_1", createdAt: T0 });
    const e2 = buildEntry({
      entryId: "entry_2",
      kind: "decision_superseded",
      supersedes: { entryId: "entry_1", reason: "user_edit" },
      createdAt: T1,
    });
    const r = appendAuditEntry([e1], e2);
    expect(r.ok).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*                    validateAuditEntryAgainstPoint                          */
/* -------------------------------------------------------------------------- */

describe("validateAuditEntryAgainstPoint", () => {
  function buildPoint(
    overrides: Partial<DecisionPoint> = {},
  ): DecisionPoint {
    return {
      id: "point.x",
      label: "Decide x",
      stage: "create",
      controlMode: "ai_suggest_user_confirm",
      required: true,
      allowMultiSelect: false,
      allowCustomValue: false,
      allowRegenerate: true,
      allowSaveAsPreset: false,
      options: [],
      ...overrides,
    };
  }

  test("ok for matching ids and a non-user_only mode", () => {
    const r = validateAuditEntryAgainstPoint(buildPoint(), buildEntry());
    expect(r).toEqual({ ok: true });
  });

  test("rejects mismatched decisionPointId", () => {
    const point = buildPoint({ id: "point.x" });
    const entry = buildEntry({ decisionPointId: "point.y" });
    expect(validateAuditEntryAgainstPoint(point, entry)).toEqual({
      ok: false,
      reason: "decision_point_mismatch",
    });
  });

  test("rejects ai source on a user_only point", () => {
    const point = buildPoint({ controlMode: "user_only" });
    const entry = buildEntry({ record: buildRecord({ source: "ai" }) });
    expect(validateAuditEntryAgainstPoint(point, entry)).toEqual({
      ok: false,
      reason: "ai_source_disallowed_in_user_only_point",
    });
  });

  test("rejects ai_edited on a user_only point", () => {
    const point = buildPoint({ controlMode: "user_only" });
    const entry = buildEntry({ record: buildRecord({ source: "ai_edited" }) });
    expect(validateAuditEntryAgainstPoint(point, entry)).toEqual({
      ok: false,
      reason: "ai_source_disallowed_in_user_only_point",
    });
  });

  test("allows user source on a user_only point", () => {
    const point = buildPoint({ controlMode: "user_only" });
    const entry = buildEntry({ record: buildRecord({ source: "user" }) });
    expect(validateAuditEntryAgainstPoint(point, entry)).toEqual({ ok: true });
  });

  test("ignores source check when entry has no record", () => {
    const point = buildPoint({ controlMode: "user_only" });
    const entry = buildEntry({
      kind: "ai_suggestion_rejected",
      record: null,
      alternativesOffered: [{ optionId: "opt_a", source: "ai" }],
    });
    expect(validateAuditEntryAgainstPoint(point, entry)).toEqual({ ok: true });
  });
});

/* -------------------------------------------------------------------------- */
/*                             Projections                                    */
/* -------------------------------------------------------------------------- */

describe("findCurrentDecision + decisionTrailFor", () => {
  const target = { kind: "brief" as AuditTargetKind, id: "brief_1" };

  function makeLog(): DecisionAuditLog {
    const e1 = buildEntry({
      entryId: "entry_1",
      createdAt: T0,
      record: buildRecord({ recordId: "rec_1", value: "v1" }),
    });
    const e2 = buildEntry({
      entryId: "entry_2",
      kind: "decision_superseded",
      supersedes: { entryId: "entry_1", reason: "user_edit" },
      record: buildRecord({ recordId: "rec_2", value: "v2" }),
      createdAt: T1,
    });
    const e3 = buildEntry({
      entryId: "entry_3",
      kind: "ai_suggestion_offered",
      record: null,
      alternativesOffered: [{ optionId: "opt_b", source: "ai" }],
      createdAt: T2,
    });
    return [e1, e2, e3];
  }

  test("returns the latest non-superseded record-bearing entry", () => {
    const head = findCurrentDecision(makeLog(), target, "point.x");
    expect(head?.entryId).toBe("entry_2");
    expect(head?.record?.value).toBe("v2");
  });

  test("ignores offer/reject entries when picking head", () => {
    const log: DecisionAuditLog = [
      buildEntry({ entryId: "entry_1", createdAt: T0 }),
      buildEntry({
        entryId: "entry_2",
        kind: "ai_suggestion_offered",
        record: null,
        createdAt: T1,
      }),
    ];
    const head = findCurrentDecision(log, target, "point.x");
    expect(head?.entryId).toBe("entry_1");
  });

  test("returns null when no committed entry exists", () => {
    const log: DecisionAuditLog = [
      buildEntry({
        entryId: "entry_1",
        kind: "ai_suggestion_offered",
        record: null,
        createdAt: T0,
      }),
    ];
    expect(findCurrentDecision(log, target, "point.x")).toBeNull();
  });

  test("ignores entries for a different target", () => {
    const log: DecisionAuditLog = [
      buildEntry({
        entryId: "entry_1",
        target: { kind: "brief", id: "brief_other", path: "" },
        createdAt: T0,
      }),
    ];
    expect(findCurrentDecision(log, target, "point.x")).toBeNull();
  });

  test("ignores entries for a different decision point", () => {
    const log: DecisionAuditLog = [
      buildEntry({
        entryId: "entry_1",
        decisionPointId: "point.other",
        createdAt: T0,
      }),
    ];
    expect(findCurrentDecision(log, target, "point.x")).toBeNull();
  });

  test("decisionTrailFor returns every entry for (target, point), in commit order", () => {
    const trail = decisionTrailFor(makeLog(), target, "point.x");
    expect(trail.map((e) => e.entryId)).toEqual([
      "entry_1",
      "entry_2",
      "entry_3",
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/*                           Cross-system queries                             */
/* -------------------------------------------------------------------------- */

describe("auditEntriesForRun/Brief/ScheduleEntry", () => {
  const log: DecisionAuditLog = [
    buildEntry({
      entryId: "entry_1",
      runId: "run_A",
      briefId: "brief_A",
      scheduleEntryId: "sched_A",
      createdAt: T0,
    }),
    buildEntry({
      entryId: "entry_2",
      runId: "run_A",
      briefId: "brief_B",
      scheduleEntryId: null,
      createdAt: T1,
    }),
    buildEntry({
      entryId: "entry_3",
      runId: null,
      briefId: null,
      scheduleEntryId: "sched_A",
      createdAt: T2,
    }),
  ];

  test("auditEntriesForRun filters by runId", () => {
    expect(auditEntriesForRun(log, "run_A").map((e) => e.entryId)).toEqual([
      "entry_1",
      "entry_2",
    ]);
    expect(auditEntriesForRun(log, "run_Z")).toEqual([]);
  });

  test("auditEntriesForBrief filters by briefId", () => {
    expect(auditEntriesForBrief(log, "brief_A").map((e) => e.entryId)).toEqual([
      "entry_1",
    ]);
  });

  test("auditEntriesForScheduleEntry filters by scheduleEntryId", () => {
    expect(
      auditEntriesForScheduleEntry(log, "sched_A").map((e) => e.entryId),
    ).toEqual(["entry_1", "entry_3"]);
  });
});

/* -------------------------------------------------------------------------- */
/*                              Predicates                                    */
/* -------------------------------------------------------------------------- */

describe("predicates", () => {
  const target = { kind: "brief" as AuditTargetKind, id: "brief_1" };

  test("wasOverriddenByUser is true when a user_override entry exists in the trail", () => {
    const log: DecisionAuditLog = [
      buildEntry({ entryId: "entry_1", createdAt: T0 }),
      buildEntry({
        entryId: "entry_2",
        kind: "user_override",
        record: buildRecord({ source: "user" }),
        supersedes: { entryId: "entry_1", reason: "user_edit" },
        createdAt: T1,
      }),
    ];
    expect(wasOverriddenByUser(log, target, "point.x")).toBe(true);
  });

  test("wasOverriddenByUser is false when no user_override entry exists", () => {
    const log: DecisionAuditLog = [
      buildEntry({ entryId: "entry_1", createdAt: T0 }),
    ];
    expect(wasOverriddenByUser(log, target, "point.x")).toBe(false);
  });

  test("isHeadDecisionAutonomous true when head was an autonomous_override", () => {
    const log: DecisionAuditLog = [
      buildEntry({
        entryId: "entry_1",
        kind: "autonomous_override",
        record: buildRecord({ source: "ai" }),
        runId: "run_1",
        createdAt: T0,
      }),
    ];
    expect(isHeadDecisionAutonomous(log, target, "point.x")).toBe(true);
  });

  test("isHeadDecisionAutonomous false when head was a user decision_committed", () => {
    const log: DecisionAuditLog = [
      buildEntry({ entryId: "entry_1", createdAt: T0 }),
    ];
    expect(isHeadDecisionAutonomous(log, target, "point.x")).toBe(false);
  });

  test("supersedeReasonOf returns the reason for a supersede entry", () => {
    const e = buildEntry({
      kind: "decision_superseded",
      supersedes: { entryId: "entry_0", reason: "ai_regenerate" },
    });
    expect(supersedeReasonOf(e)).toBe<AuditSupersedeReason>("ai_regenerate");
  });

  test("supersedeReasonOf returns null when no supersedes block present", () => {
    expect(supersedeReasonOf(buildEntry())).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/*                              Read helpers                                  */
/* -------------------------------------------------------------------------- */

describe("read helpers", () => {
  test("listAuditEntryKinds returns the canonical AUDIT_ENTRY_KINDS", () => {
    expect(listAuditEntryKinds()).toEqual(AUDIT_ENTRY_KINDS);
  });

  test("listAuditTargetKinds returns the canonical AUDIT_TARGET_KINDS", () => {
    expect(listAuditTargetKinds()).toEqual(AUDIT_TARGET_KINDS);
  });

  test("listAuditSupersedeReasons returns the canonical AUDIT_SUPERSEDE_REASONS", () => {
    expect(listAuditSupersedeReasons()).toEqual(AUDIT_SUPERSEDE_REASONS);
  });
});
