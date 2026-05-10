import { describe, expect, it } from "vitest";
import type { DecisionRecord } from "./decision-point.js";
import {
  computeBlockedStages,
  DEFAULT_DECISION_POINTS,
  findDecisionPoint,
  getDecisionPointsForStage,
  JOURNEY_STAGE_DESCRIPTORS,
  JOURNEY_STAGES,
  JourneyStageSchema,
  nextRequiredStage,
  type JourneyStage,
} from "./customer-journey.js";

const KEBAB_OR_DOTTED = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

const recordFor = (
  decisionPointId: string,
  overrides: Partial<DecisionRecord> = {},
): DecisionRecord => ({
  recordId: `rec-${decisionPointId}`,
  decisionPointId,
  workspaceId: "w1",
  actorUserId: "u1",
  source: "user",
  committedAt: "2026-05-10T05:00:00.000Z",
  chosenOptionId: null,
  value: "ok",
  ...overrides,
});

describe("JOURNEY_STAGES", () => {
  it("starts at intake and ends at measure", () => {
    expect(JOURNEY_STAGES[0]).toBe("intake");
    expect(JOURNEY_STAGES[JOURNEY_STAGES.length - 1]).toBe("measure");
  });

  it("contains every documented stage exactly once", () => {
    expect(new Set(JOURNEY_STAGES).size).toBe(JOURNEY_STAGES.length);
    expect(JOURNEY_STAGES).toContain("schedule");
    expect(JOURNEY_STAGES).toContain("seo_meta");
    expect(JOURNEY_STAGES).toContain("review");
    expect(JOURNEY_STAGES).toContain("publish");
  });

  it("validates against JourneyStageSchema", () => {
    for (const stage of JOURNEY_STAGES) {
      expect(JourneyStageSchema.safeParse(stage).success).toBe(true);
    }
    expect(JourneyStageSchema.safeParse("nope").success).toBe(false);
  });
});

describe("JOURNEY_STAGE_DESCRIPTORS", () => {
  it("has a descriptor entry for every stage", () => {
    for (const stage of JOURNEY_STAGES) {
      const d = JOURNEY_STAGE_DESCRIPTORS[stage];
      expect(d, `descriptor missing for ${stage}`).toBeDefined();
      expect(d.id).toBe(stage);
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.description.length).toBeGreaterThan(0);
    }
  });

  it("references real decision-point ids in every descriptor", () => {
    const allIds = new Set(DEFAULT_DECISION_POINTS.map((p) => p.id));
    for (const stage of JOURNEY_STAGES) {
      for (const id of JOURNEY_STAGE_DESCRIPTORS[stage].decisionPointIds) {
        expect(
          allIds.has(id),
          `${stage}.decisionPointIds references unknown id ${id}`,
        ).toBe(true);
      }
    }
  });

  it("freezes the descriptor record so consumers cannot mutate it", () => {
    expect(Object.isFrozen(JOURNEY_STAGE_DESCRIPTORS)).toBe(true);
  });
});

describe("DEFAULT_DECISION_POINTS", () => {
  it("uses globally unique ids that are dot/kebab-case", () => {
    const seen = new Set<string>();
    for (const p of DEFAULT_DECISION_POINTS) {
      expect(KEBAB_OR_DOTTED.test(p.id), `${p.id} not dotted/kebab`).toBe(true);
      expect(seen.has(p.id), `duplicate id ${p.id}`).toBe(false);
      seen.add(p.id);
    }
  });

  it("only references known stages on every point", () => {
    const validStages = new Set<JourneyStage>(JOURNEY_STAGES);
    for (const p of DEFAULT_DECISION_POINTS) {
      expect(
        validStages.has(p.stage as JourneyStage),
        `${p.id} has unknown stage ${p.stage}`,
      ).toBe(true);
    }
  });

  it("only uses the four canonical control modes", () => {
    const allowed = new Set([
      "user_only",
      "ai_with_optional_override",
      "user_with_ai_assist",
      "ai_suggest_user_confirm",
    ]);
    for (const p of DEFAULT_DECISION_POINTS) {
      expect(
        allowed.has(p.controlMode),
        `${p.id} uses unknown controlMode ${p.controlMode}`,
      ).toBe(true);
    }
  });

  it("ensures defaultOptionId, when set, points at one of the options", () => {
    for (const p of DEFAULT_DECISION_POINTS) {
      if (!p.defaultOptionId) continue;
      const ids = new Set(p.options.map((o) => o.id));
      expect(
        ids.has(p.defaultOptionId),
        `${p.id}.defaultOptionId ${p.defaultOptionId} not in options`,
      ).toBe(true);
    }
  });
});

describe("schedule.authority — the user's specifically requested decision", () => {
  const point = findDecisionPoint("schedule.authority");

  it("exists and is required", () => {
    expect(point).toBeDefined();
    expect(point?.required).toBe(true);
    expect(point?.stage).toBe("schedule");
  });

  it("uses user_only so the user always picks the authority mode", () => {
    expect(point?.controlMode).toBe("user_only");
  });

  it("offers exactly the three modes the product promises", () => {
    expect(point?.options.map((o) => o.id).sort()).toEqual([
      "schedule-authority-ai-auto",
      "schedule-authority-ai-confirm",
      "schedule-authority-manual",
    ]);
  });

  it("defaults to AI-suggest-confirm rather than fully manual or fully automatic", () => {
    expect(point?.defaultOptionId).toBe("schedule-authority-ai-confirm");
  });
});

describe("getDecisionPointsForStage / findDecisionPoint", () => {
  it("returns every catalog point belonging to the requested stage", () => {
    const seoPoints = getDecisionPointsForStage("seo_meta");
    expect(seoPoints.length).toBeGreaterThanOrEqual(2);
    expect(seoPoints.every((p) => p.stage === "seo_meta")).toBe(true);
  });

  it("returns undefined for unknown ids", () => {
    expect(findDecisionPoint("schedule.does-not-exist")).toBeUndefined();
  });
});

describe("computeBlockedStages / nextRequiredStage", () => {
  it("blocks every stage that has a required point with no record", () => {
    const blocked = computeBlockedStages([]);
    expect(blocked).toContain("intake");
    expect(blocked).toContain("schedule");
    expect(blocked).toContain("publish");
  });

  it("returns intake first when nothing has been committed", () => {
    expect(nextRequiredStage([])).toBe("intake");
  });

  it("does not block stages whose only points are non-required", () => {
    // Only the "concept" stage has a non-required point in the default
    // catalog, so even with zero records it should not be in the blocked
    // list (skippable + non-required → satisfied).
    const blocked = computeBlockedStages([]);
    expect(blocked).not.toContain("concept");
    expect(blocked).not.toContain("measure");
  });

  it("unblocks a stage once every required point has a record", () => {
    const intakePoints = getDecisionPointsForStage("intake");
    const records = intakePoints
      .filter((p) => p.required)
      .map((p) =>
        recordFor(p.id, {
          chosenOptionId: null,
          value: "free-text",
          source: "user",
        }),
      );
    const blocked = computeBlockedStages(records);
    expect(blocked).not.toContain("intake");
    expect(nextRequiredStage(records)).toBe("strategy");
  });
});
