import { describe, expect, it } from "vitest";
import {
  commitDecision,
  DECISION_CONTROL_MODES,
  DecisionControlModeSchema,
  DecisionOptionSchema,
  DecisionPointSchema,
  DecisionRecordSchema,
  isDecisionSatisfied,
  resolveCommittedValue,
  validateDecisionRecord,
  type DecisionPoint,
  type DecisionRecord,
} from "./decision-point.js";

const userOnlyPoint: DecisionPoint = {
  id: "schedule.authority",
  stage: "schedule",
  label: "How should we set publish dates?",
  controlMode: "user_only",
  required: true,
  allowMultiSelect: false,
  allowCustomValue: false,
  allowRegenerate: false,
  allowSaveAsPreset: true,
  options: [
    {
      id: "manual",
      label: "I pick every date",
      value: { mode: "manual" },
      source: "system",
    },
    {
      id: "ai-suggest",
      label: "AI suggests, I confirm",
      value: { mode: "ai_suggest" },
      source: "system",
    },
    {
      id: "ai-auto",
      label: "AI schedules for me",
      value: { mode: "ai_auto" },
      source: "system",
    },
  ],
  defaultOptionId: "ai-suggest",
};

const assistPoint: DecisionPoint = {
  id: "intake.brief",
  stage: "intake",
  label: "Campaign brief",
  controlMode: "user_with_ai_assist",
  required: true,
  allowMultiSelect: false,
  allowCustomValue: true,
  allowRegenerate: true,
  allowSaveAsPreset: true,
  options: [],
};

describe("DecisionControlModeSchema — the four canonical modes", () => {
  it("contains exactly the four modes the product invariant requires", () => {
    expect([...DECISION_CONTROL_MODES].sort()).toEqual([
      "ai_suggest_user_confirm",
      "ai_with_optional_override",
      "user_only",
      "user_with_ai_assist",
    ]);
  });

  it("rejects any mode outside the four canonical values", () => {
    expect(DecisionControlModeSchema.safeParse("ai_only").success).toBe(false);
    expect(DecisionControlModeSchema.safeParse("manual").success).toBe(false);
    expect(DecisionControlModeSchema.safeParse("user_only").success).toBe(true);
    expect(
      DecisionControlModeSchema.safeParse("ai_with_optional_override").success,
    ).toBe(true);
    expect(
      DecisionControlModeSchema.safeParse("user_with_ai_assist").success,
    ).toBe(true);
    expect(
      DecisionControlModeSchema.safeParse("ai_suggest_user_confirm").success,
    ).toBe(true);
  });
});

describe("DecisionOptionSchema", () => {
  it("accepts a well-formed option", () => {
    const ok = DecisionOptionSchema.safeParse({
      id: "manual",
      label: "Pick myself",
      value: { mode: "manual" },
      source: "system",
    });
    expect(ok.success).toBe(true);
  });

  it("rejects bogus source", () => {
    const bad = DecisionOptionSchema.safeParse({
      id: "x",
      label: "x",
      value: 1,
      source: "magic",
    });
    expect(bad.success).toBe(false);
  });
});

describe("DecisionPointSchema + DecisionRecordSchema", () => {
  it("accepts the canonical schedule.authority shape", () => {
    expect(DecisionPointSchema.safeParse(userOnlyPoint).success).toBe(true);
  });

  it("requires an actorUserId on every record", () => {
    const bad = DecisionRecordSchema.safeParse({
      recordId: "r1",
      decisionPointId: "schedule.authority",
      workspaceId: "w1",
      source: "user",
      committedAt: new Date().toISOString(),
      chosenOptionId: "manual",
      value: { mode: "manual" },
    });
    expect(bad.success).toBe(false);
  });
});

describe("validateDecisionRecord", () => {
  const record = (
    overrides: Partial<DecisionRecord> = {},
  ): DecisionRecord => ({
    recordId: "r1",
    decisionPointId: "schedule.authority",
    workspaceId: "w1",
    actorUserId: "u1",
    source: "user",
    committedAt: "2026-05-10T05:00:00.000Z",
    chosenOptionId: "manual",
    value: { mode: "manual" },
    ...overrides,
  });

  it("accepts a valid user pick on a user_only point", () => {
    const r = validateDecisionRecord(userOnlyPoint, record());
    expect(r.ok).toBe(true);
  });

  it("rejects an ai source on a user_only point", () => {
    const r = validateDecisionRecord(userOnlyPoint, record({ source: "ai" }));
    expect(r).toEqual({
      ok: false,
      reason: "ai_source_disallowed_in_user_only_point",
    });
  });

  it("rejects an ai_edited source on a user_only point", () => {
    const r = validateDecisionRecord(
      userOnlyPoint,
      record({ source: "ai_edited" }),
    );
    expect(r).toEqual({
      ok: false,
      reason: "ai_source_disallowed_in_user_only_point",
    });
  });

  it("rejects mismatched decisionPointId", () => {
    const r = validateDecisionRecord(
      userOnlyPoint,
      record({ decisionPointId: "intake.brief" }),
    );
    expect(r).toEqual({ ok: false, reason: "decision_point_mismatch" });
  });

  it("rejects an unknown chosenOptionId", () => {
    const r = validateDecisionRecord(
      userOnlyPoint,
      record({ chosenOptionId: "ghost" }),
    );
    expect(r).toEqual({ ok: false, reason: "unknown_option_id" });
  });

  it("rejects custom values when allowCustomValue is false", () => {
    const r = validateDecisionRecord(
      userOnlyPoint,
      record({ chosenOptionId: null, value: { custom: true } }),
    );
    expect(r).toEqual({ ok: false, reason: "custom_value_not_allowed" });
  });

  it("accepts custom values when allowCustomValue is true", () => {
    const r = validateDecisionRecord(assistPoint, {
      recordId: "r-c",
      decisionPointId: "intake.brief",
      workspaceId: "w1",
      actorUserId: "u1",
      source: "user",
      committedAt: "2026-05-10T05:00:00.000Z",
      chosenOptionId: null,
      value: "Free-form brief I typed myself",
    });
    expect(r.ok).toBe(true);
  });
});

describe("resolveCommittedValue", () => {
  const baseRecord: DecisionRecord = {
    recordId: "r1",
    decisionPointId: "schedule.authority",
    workspaceId: "w1",
    actorUserId: "u1",
    source: "user",
    committedAt: "2026-05-10T05:00:00.000Z",
    chosenOptionId: "manual",
    value: { mode: "manual" },
  };

  it("returns the system default when no record exists", () => {
    const r = resolveCommittedValue(userOnlyPoint, []);
    expect(r.value).toEqual({ mode: "ai_suggest" });
    expect(r.source).toBe("system");
  });

  it("returns the latest record when multiple exist for the point", () => {
    const earlier = baseRecord;
    const later: DecisionRecord = {
      ...baseRecord,
      recordId: "r2",
      committedAt: "2026-05-11T05:00:00.000Z",
      chosenOptionId: "ai-auto",
      value: { mode: "ai_auto" },
      replacesRecordId: "r1",
    };
    const r = resolveCommittedValue(userOnlyPoint, [earlier, later]);
    expect(r.recordId).toBe("r2");
    expect(r.value).toEqual({ mode: "ai_auto" });
  });

  it("ignores records for a different decision point", () => {
    const otherPoint: DecisionRecord = {
      ...baseRecord,
      recordId: "r-other",
      decisionPointId: "publish.mode",
    };
    const r = resolveCommittedValue(userOnlyPoint, [otherPoint]);
    expect(r.source).toBe("system");
  });

  it("returns undefined when no record and no default", () => {
    const noDefault: DecisionPoint = { ...userOnlyPoint, defaultOptionId: undefined };
    const r = resolveCommittedValue(noDefault, []);
    expect(r.value).toBeUndefined();
    expect(r.source).toBe("default");
  });
});

describe("isDecisionSatisfied", () => {
  it("returns true for non-required points without records", () => {
    const p: DecisionPoint = { ...userOnlyPoint, required: false };
    expect(isDecisionSatisfied(p, [])).toBe(true);
  });

  it("returns false for required points without records", () => {
    expect(isDecisionSatisfied(userOnlyPoint, [])).toBe(false);
  });

  it("returns true once any record exists for a required point", () => {
    const r: DecisionRecord = {
      recordId: "r1",
      decisionPointId: "schedule.authority",
      workspaceId: "w1",
      actorUserId: "u1",
      source: "user",
      committedAt: "2026-05-10T05:00:00.000Z",
      chosenOptionId: "manual",
      value: { mode: "manual" },
    };
    expect(isDecisionSatisfied(userOnlyPoint, [r])).toBe(true);
  });
});

describe("commitDecision", () => {
  it("builds a record with the option's value when chosenOptionId is set", () => {
    const r = commitDecision({
      point: userOnlyPoint,
      recordId: "r1",
      workspaceId: "w1",
      actorUserId: "u1",
      chosenOptionId: "ai-auto",
      source: "user",
      committedAt: "2026-05-10T05:00:00.000Z",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.record.value).toEqual({ mode: "ai_auto" });
      expect(r.record.chosenOptionId).toBe("ai-auto");
    }
  });

  it("propagates a validation reason rather than throwing", () => {
    const r = commitDecision({
      point: userOnlyPoint,
      recordId: "r1",
      workspaceId: "w1",
      actorUserId: "u1",
      chosenOptionId: "ai-auto",
      source: "ai",
      committedAt: "2026-05-10T05:00:00.000Z",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("ai_source_disallowed_in_user_only_point");
    }
  });

  it("commits a custom value on points that allow it", () => {
    const r = commitDecision({
      point: assistPoint,
      recordId: "r2",
      workspaceId: "w1",
      actorUserId: "u1",
      chosenOptionId: null,
      customValue: "Brief copy I typed myself",
      source: "user",
      committedAt: "2026-05-10T05:00:00.000Z",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.record.value).toBe("Brief copy I typed myself");
      expect(r.record.chosenOptionId).toBeNull();
    }
  });
});
