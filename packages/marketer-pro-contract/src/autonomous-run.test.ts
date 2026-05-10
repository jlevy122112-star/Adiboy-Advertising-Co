import { describe, expect, test } from "vitest";

import { type AutonomousRunEvent } from "./autonomous-run-events.js";
import {
  AutonomousRunSchema,
  applyEvent,
  assetAttempts,
  assetAttemptsExceeded,
  createRun,
  DEFAULT_RETRY_BUDGET,
  firstSuccessfulPublishOf,
  isInActivePhase,
  isRunComplete,
  isStuck,
  listAllRunStates,
  requiresUserInterrupt,
  RetryBudgetSchema,
  runProgress,
  totalErrorBudgetExceeded,
  userOnlyDecisionsBlocking,
  type AutonomousRun,
  type CreateRunArgs,
} from "./autonomous-run.js";
import { type DecisionPoint, type DecisionRecord } from "./decision-point.js";
import { DEFAULT_AUTONOMY_POLICY } from "./workspace-autonomy.js";

const T0 = "2026-05-10T12:00:00.000Z";
const T1 = "2026-05-10T12:01:00.000Z";
const T2 = "2026-05-10T12:02:00.000Z";
const T3 = "2026-05-10T12:03:00.000Z";

const baseRequest = {
  workspaceId: "ws_001",
  requestedByUserId: "user_007",
  platforms: ["instagram", "x"] as ("instagram" | "x")[],
  scope: "single_post" as const,
};

const autonomousPolicy = {
  ...DEFAULT_AUTONOMY_POLICY,
  mode: "autonomous" as const,
};

function newRun(args: Partial<CreateRunArgs> = {}): AutonomousRun {
  return createRun({
    runId: args.runId ?? "run_001",
    workspaceId: args.workspaceId ?? "ws_001",
    request: args.request ?? baseRequest,
    policy: args.policy ?? autonomousPolicy,
    retryBudget: args.retryBudget,
    now: args.now ?? (() => T0),
  });
}

const baseEvt = {
  eventId: "evt_x",
  runId: "run_001",
  occurredAt: T1,
  actorUserId: null as string | null,
};

function evt<T extends AutonomousRunEvent["type"]>(
  type: T,
  extras: object = {},
  overrides: Partial<typeof baseEvt> = {},
): AutonomousRunEvent {
  return { ...baseEvt, ...overrides, type, ...extras } as AutonomousRunEvent;
}

/* -------------------------------------------------------------------------- */
/*                              RetryBudgetSchema                             */
/* -------------------------------------------------------------------------- */

describe("RetryBudgetSchema + DEFAULT_RETRY_BUDGET", () => {
  test("DEFAULT_RETRY_BUDGET is a valid budget", () => {
    expect(RetryBudgetSchema.parse(DEFAULT_RETRY_BUDGET)).toEqual(
      DEFAULT_RETRY_BUDGET,
    );
  });

  test("DEFAULT_RETRY_BUDGET defaults to 5/20/1000", () => {
    expect(DEFAULT_RETRY_BUDGET).toEqual({
      maxPerAssetAttempts: 5,
      maxTotalRunErrors: 20,
      retryBackoffMs: 1_000,
    });
  });

  test("rejects out-of-range values", () => {
    expect(() =>
      RetryBudgetSchema.parse({ ...DEFAULT_RETRY_BUDGET, maxPerAssetAttempts: 0 }),
    ).toThrow();
    expect(() =>
      RetryBudgetSchema.parse({ ...DEFAULT_RETRY_BUDGET, retryBackoffMs: 99 }),
    ).toThrow();
    expect(() =>
      RetryBudgetSchema.parse({ ...DEFAULT_RETRY_BUDGET, maxTotalRunErrors: 101 }),
    ).toThrow();
  });

  test("rejects extra fields (strict)", () => {
    expect(() =>
      RetryBudgetSchema.parse({ ...DEFAULT_RETRY_BUDGET, custom: 1 }),
    ).toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/*                              createRun                                     */
/* -------------------------------------------------------------------------- */

describe("createRun", () => {
  test("returns a run that parses against AutonomousRunSchema", () => {
    const run = newRun();
    expect(AutonomousRunSchema.parse(run)).toEqual(run);
  });

  test("starts in `requested` with empty buffers", () => {
    const run = newRun();
    expect(run.state).toBe("requested");
    expect(run.events).toEqual([]);
    expect(run.decisionRecords).toEqual([]);
    expect(run.attemptsByAsset).toEqual({});
    expect(run.failureKind).toBeNull();
    expect(run.cancelReason).toBeNull();
    expect(run.resumeState).toBeNull();
    expect(run.terminatedAt).toBeNull();
  });

  test("`now` injection drives createdAt + updatedAt + enteredCurrentStateAt", () => {
    const run = newRun({ now: () => T0 });
    expect(run.createdAt).toBe(T0);
    expect(run.updatedAt).toBe(T0);
    expect(run.enteredCurrentStateAt).toBe(T0);
  });

  test("uses DEFAULT_RETRY_BUDGET when none is provided", () => {
    expect(newRun().retryBudget).toEqual(DEFAULT_RETRY_BUDGET);
  });

  test("respects a custom retry budget", () => {
    const custom = {
      maxPerAssetAttempts: 2,
      maxTotalRunErrors: 5,
      retryBackoffMs: 2000,
    };
    expect(newRun({ retryBudget: custom }).retryBudget).toEqual(custom);
  });
});

/* -------------------------------------------------------------------------- */
/*                              applyEvent: rejections                        */
/* -------------------------------------------------------------------------- */

describe("applyEvent — rejections", () => {
  test("refuses on a run already in a terminal state", () => {
    let run = newRun();
    const advance = (e: AutonomousRunEvent) => applyEvent(run, e, { now: () => T1 });
    run = (advance(evt("state_change", {
      fromState: "requested",
      toState: "validating",
      failureKind: null,
    })) as { ok: true; run: AutonomousRun }).run;
    run = (advance(evt("state_change", {
      fromState: "validating",
      toState: "planning",
      failureKind: null,
    })) as { ok: true; run: AutonomousRun }).run;
    run = (advance(evt("cancel_requested")) as { ok: true; run: AutonomousRun }).run;
    expect(run.state).toBe("cancelled");
    const result = applyEvent(run, evt("pause_requested"), { now: () => T2 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("run_in_terminal_state");
  });

  test("refuses on an illegal transition", () => {
    const run = newRun();
    const result = applyEvent(
      run,
      evt("state_change", {
        fromState: "requested",
        toState: "publishing",
        failureKind: null,
      }),
      { now: () => T1 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("illegal_transition");
  });

  test("refuses when state_change.fromState mismatches run.state", () => {
    const run = newRun();
    const result = applyEvent(
      run,
      evt("state_change", {
        fromState: "planning", // run is in "requested"
        toState: "generating",
        failureKind: null,
      }),
      { now: () => T1 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("from_state_mismatch");
  });

  test("refuses on schema-invalid event", () => {
    const run = newRun();
    const result = applyEvent(
      run,
      // invalid: state_change with toState=failed but no failureKind
      evt("state_change", {
        fromState: "requested",
        toState: "failed",
        failureKind: null,
      }),
      { now: () => T1 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("schema_validation_failed");
  });
});

/* -------------------------------------------------------------------------- */
/*                              applyEvent: audit only                        */
/* -------------------------------------------------------------------------- */

describe("applyEvent — audit-only events", () => {
  test("decision_committed appends without state change", () => {
    let run = newRun();
    run = (applyEvent(run, evt("state_change", {
      fromState: "requested",
      toState: "validating",
      failureKind: null,
    }), { now: () => T1 }) as { ok: true; run: AutonomousRun }).run;
    const before = run.state;
    const result = applyEvent(
      run,
      evt("decision_committed", {
        decisionRecordId: "rec_1",
        decisionPointId: "schedule.dates",
        source: "ai",
        controlMode: "ai_with_optional_override",
        committedAt: T2,
      }),
      { now: () => T2 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.run.state).toBe(before);
      expect(result.run.events).toHaveLength(2);
      expect(result.emittedEvents).toHaveLength(1);
    }
  });

  test("provider_result success bumps attemptsByAsset", () => {
    const run = advanceTo(newRun(), "publishing");
    const result = applyEvent(
      run,
      evt("provider_result", {
        network: "instagram",
        scheduleEntryId: "se_1",
        ok: true,
        externalId: "ig_42",
        detail: null,
        attempt: 1,
      }),
      { now: () => T3 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.run.attemptsByAsset["se_1"]).toBe(1);
    }
  });

  test("error events increment totalErrors but stay (when recoverable)", () => {
    const run = advanceTo(newRun(), "generating");
    const r1 = applyEvent(
      run,
      evt("error", {
        errorCode: "io",
        message: "transient",
        recoverable: true,
        failureKind: null,
      }),
      { now: () => T2 },
    );
    expect(r1.ok).toBe(true);
    if (r1.ok) {
      expect(r1.run.totalErrors).toBe(1);
      expect(r1.run.state).toBe("generating");
    }
  });

  test("non-recoverable error transitions to failed and sets failureKind", () => {
    const run = advanceTo(newRun(), "generating");
    const result = applyEvent(
      run,
      evt("error", {
        errorCode: "fatal",
        message: "panic",
        recoverable: false,
        failureKind: "internal_error",
      }),
      { now: () => T2 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.run.state).toBe("failed");
      expect(result.run.failureKind).toBe("internal_error");
      expect(result.run.totalErrors).toBe(1);
      expect(result.run.terminatedAt).toBe(T2);
    }
  });

  test("notification_sent appends without state change", () => {
    const run = advanceTo(newRun(), "publishing");
    const result = applyEvent(
      run,
      evt("notification_sent", {
        reason: "first_publish_per_post",
        channels: ["in_app"],
      }),
      { now: () => T2 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.run.state).toBe("publishing");
      expect(result.run.events.at(-1)?.type).toBe("notification_sent");
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                              applyEvent: transitions                       */
/* -------------------------------------------------------------------------- */

describe("applyEvent — transitions", () => {
  test("happy path requested → validating → planning", () => {
    let run = newRun();
    let r = applyEvent(run, evt("state_change", {
      fromState: "requested",
      toState: "validating",
      failureKind: null,
    }), { now: () => T1 });
    expect(r.ok).toBe(true);
    if (r.ok) run = r.run;
    expect(run.state).toBe("validating");

    r = applyEvent(run, evt("state_change", {
      fromState: "validating",
      toState: "planning",
      failureKind: null,
    }), { now: () => T2 });
    expect(r.ok).toBe(true);
    if (r.ok) run = r.run;
    expect(run.state).toBe("planning");
    expect(run.enteredCurrentStateAt).toBe(T2);
  });

  test("entering blocking state captures resumeState", () => {
    const run = advanceTo(newRun(), "generating");
    const r = applyEvent(run, evt("pause_requested"), { now: () => T2 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.run.state).toBe("paused");
      expect(r.run.resumeState).toBe("generating");
    }
  });

  test("entering awaiting_user from active state captures resumeState", () => {
    const run = advanceTo(newRun(), "scheduling");
    const r = applyEvent(run, evt("state_change", {
      fromState: "scheduling",
      toState: "awaiting_user",
      failureKind: null,
    }), { now: () => T2 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.run.state).toBe("awaiting_user");
      expect(r.run.resumeState).toBe("scheduling");
    }
  });

  test("transition to terminal sets terminatedAt + final state", () => {
    const run = advanceTo(newRun(), "publishing");
    const r = applyEvent(run, evt("state_change", {
      fromState: "publishing",
      toState: "completed",
      failureKind: null,
    }), { now: () => T3 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.run.state).toBe("completed");
      expect(r.run.terminatedAt).toBe(T3);
    }
  });

  test("cancel_requested sets cancelReason and transitions to cancelled", () => {
    const run = advanceTo(newRun(), "planning");
    const r = applyEvent(
      run,
      evt("cancel_requested", { reason: "wrong campaign" }, { actorUserId: "user_007" }),
      { now: () => T2 },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.run.state).toBe("cancelled");
      expect(r.run.cancelReason).toBe("wrong campaign");
      expect(r.run.terminatedAt).toBe(T2);
    }
  });

  test("timeout transitions to failed with failureKind=timeout", () => {
    const run = advanceTo(newRun(), "generating");
    const r = applyEvent(
      run,
      evt("timeout", {
        state: "generating",
        enteredAt: T1,
        expectedTimeoutMs: 60_000,
      }),
      { now: () => T2 },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.run.state).toBe("failed");
      expect(r.run.failureKind).toBe("timeout");
    }
  });

  test("pause_requested from awaiting_user → no transition (audit only)", () => {
    const run = advanceTo(newRun(), "awaiting_user", "generating");
    const r = applyEvent(run, evt("pause_requested"), { now: () => T3 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.run.state).toBe("awaiting_user"); // unchanged
      expect(r.run.events.at(-1)?.type).toBe("pause_requested");
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                              applyEvent: resume                            */
/* -------------------------------------------------------------------------- */

describe("applyEvent — resume_requested", () => {
  test("from paused with resumeState synthesizes a state_change back", () => {
    const run = advanceTo(newRun(), "paused", "generating");
    expect(run.resumeState).toBe("generating");

    const r = applyEvent(
      run,
      evt("resume_requested", {}, { actorUserId: "user_007", eventId: "evt_resume" }),
      { now: () => T3, nextEventId: () => "evt_resume_synth" },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.run.state).toBe("generating");
      expect(r.run.resumeState).toBeNull();
      expect(r.emittedEvents).toHaveLength(2);
      expect(r.emittedEvents[1].type).toBe("state_change");
    }
  });

  test("from awaiting_user with resumeState resumes the carried state", () => {
    const run = advanceTo(newRun(), "awaiting_user", "scheduling");
    const r = applyEvent(
      run,
      evt("resume_requested", {}, { actorUserId: "user_007" }),
      { now: () => T3 },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.run.state).toBe("scheduling");
      expect(r.run.resumeState).toBeNull();
    }
  });

  test("from blocking state without resumeState rejects with no_resume_state_set", () => {
    const run = newRun();
    // force a malformed test fixture where state is paused but resumeState is null
    const broken: AutonomousRun = { ...run, state: "paused", resumeState: null };
    const r = applyEvent(
      broken,
      evt("resume_requested"),
      { now: () => T3 },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no_resume_state_set");
  });

  test("from active state is an audit-only no-op", () => {
    const run = advanceTo(newRun(), "planning");
    const r = applyEvent(run, evt("resume_requested"), { now: () => T2 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.run.state).toBe("planning");
      expect(r.run.events.at(-1)?.type).toBe("resume_requested");
    }
  });
});

/* -------------------------------------------------------------------------- */
/*                              Read helpers                                  */
/* -------------------------------------------------------------------------- */

describe("read helpers", () => {
  test("assetAttempts defaults to 0 for unknown assets", () => {
    const run = newRun();
    expect(assetAttempts(run, "missing")).toBe(0);
  });

  test("assetAttemptsExceeded reflects retry budget", () => {
    let run = advanceTo(newRun(), "publishing");
    for (let i = 0; i < DEFAULT_RETRY_BUDGET.maxPerAssetAttempts; i++) {
      const r = applyEvent(
        run,
        evt("provider_result", {
          network: "x",
          scheduleEntryId: "se_1",
          ok: false,
          externalId: null,
          detail: "transient",
          attempt: i + 1,
        }),
        { now: () => T2 },
      );
      if (r.ok) run = r.run;
    }
    expect(assetAttempts(run, "se_1")).toBe(
      DEFAULT_RETRY_BUDGET.maxPerAssetAttempts,
    );
    expect(assetAttemptsExceeded(run, "se_1")).toBe(true);
    expect(assetAttemptsExceeded(run, "se_2")).toBe(false);
  });

  test("totalErrorBudgetExceeded fires after maxTotalRunErrors", () => {
    let run = advanceTo(newRun(), "generating", undefined, {
      retryBudget: { maxPerAssetAttempts: 5, maxTotalRunErrors: 3, retryBackoffMs: 100 },
    });
    for (let i = 0; i < 3; i++) {
      const r = applyEvent(
        run,
        evt("error", {
          errorCode: "transient",
          message: "x",
          recoverable: true,
          failureKind: null,
        }),
        { now: () => T2 },
      );
      if (r.ok) run = r.run;
    }
    expect(totalErrorBudgetExceeded(run)).toBe(true);
  });

  test("firstSuccessfulPublishOf finds the first ok=true result", () => {
    let run = advanceTo(newRun(), "publishing");
    run = (applyEvent(run, evt("provider_result", {
      network: "x",
      scheduleEntryId: "se_1",
      ok: false,
      externalId: null,
      detail: "rate",
      attempt: 1,
    }), { now: () => T2 }) as { ok: true; run: AutonomousRun }).run;
    run = (applyEvent(run, evt("provider_result", {
      network: "x",
      scheduleEntryId: "se_1",
      ok: true,
      externalId: "tweet_1",
      detail: null,
      attempt: 2,
    }), { now: () => T3 }) as { ok: true; run: AutonomousRun }).run;
    const found = firstSuccessfulPublishOf(run, "se_1");
    expect(found?.externalId).toBe("tweet_1");
    expect(firstSuccessfulPublishOf(run, "se_missing")).toBeUndefined();
  });

  test("requiresUserInterrupt true only for blocking states", () => {
    expect(requiresUserInterrupt(advanceTo(newRun(), "paused", "planning"))).toBe(true);
    expect(requiresUserInterrupt(advanceTo(newRun(), "awaiting_user", "scheduling"))).toBe(true);
    expect(requiresUserInterrupt(advanceTo(newRun(), "publishing"))).toBe(false);
    expect(requiresUserInterrupt(newRun())).toBe(false);
  });

  test("isRunComplete fires for completed/failed/cancelled only", () => {
    expect(isRunComplete(newRun())).toBe(false);
    expect(isRunComplete(advanceTo(newRun(), "publishing"))).toBe(false);
    expect(isRunComplete(advanceTo(newRun(), "completed"))).toBe(true);
  });

  test("isStuck respects state timeout", () => {
    const run = advanceTo(newRun(), "validating");
    const enteredMs = Date.parse(run.enteredCurrentStateAt);
    expect(isStuck(run, enteredMs + 10_000)).toBe(false); // within 30s budget
    expect(isStuck(run, enteredMs + 30_001)).toBe(true);
  });

  test("isStuck never fires for blocking states (null timeout)", () => {
    const run = advanceTo(newRun(), "paused", "generating");
    expect(isStuck(run, Date.parse(run.enteredCurrentStateAt) + 9999999)).toBe(false);
  });

  test("isStuck never fires for terminal states", () => {
    const run = advanceTo(newRun(), "completed");
    expect(isStuck(run, Date.parse(run.enteredCurrentStateAt) + 9999999)).toBe(false);
  });

  test("isInActivePhase reflects active bucket", () => {
    expect(isInActivePhase(newRun())).toBe(true);
    expect(isInActivePhase(advanceTo(newRun(), "paused", "planning"))).toBe(false);
    expect(isInActivePhase(advanceTo(newRun(), "completed"))).toBe(false);
  });

  test("listAllRunStates returns the canonical 12-tuple", () => {
    expect(listAllRunStates()).toHaveLength(12);
    expect(listAllRunStates()).toContain("ready_to_publish");
  });

  test("userOnlyDecisionsBlocking returns unsatisfied user_only points", () => {
    const points: DecisionPoint[] = [
      {
        id: "dp.user-only",
        label: "x",
        stage: "review",
        controlMode: "user_only",
        required: true,
        allowMultiSelect: false,
        allowCustomValue: false,
        allowRegenerate: false,
        allowSaveAsPreset: false,
        options: [],
      },
      {
        id: "dp.ai",
        label: "y",
        stage: "review",
        controlMode: "ai_with_optional_override",
        required: true,
        allowMultiSelect: false,
        allowCustomValue: false,
        allowRegenerate: false,
        allowSaveAsPreset: false,
        options: [],
      },
    ];
    const run = newRun();
    expect(userOnlyDecisionsBlocking(run, points).map((p) => p.id)).toEqual([
      "dp.user-only",
    ]);

    // Now satisfy it with a record
    const record: DecisionRecord = {
      recordId: "rec_1",
      decisionPointId: "dp.user-only",
      workspaceId: "ws_001",
      actorUserId: "user_007",
      source: "user",
      committedAt: T1,
      chosenOptionId: null,
      value: { mode: "self" },
    };
    const withDecision: AutonomousRun = {
      ...run,
      decisionRecords: [record],
    };
    expect(userOnlyDecisionsBlocking(withDecision, points)).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/*                              runProgress                                   */
/* -------------------------------------------------------------------------- */

describe("runProgress", () => {
  test("requested reports 0% with terminal=false, blocked=false", () => {
    const p = runProgress(newRun());
    expect(p.percent).toBe(0);
    expect(p.terminal).toBe(false);
    expect(p.blocked).toBe(false);
  });

  test("monotonically increases through active states", () => {
    const states: ("validating" | "planning" | "generating" | "scheduling" | "ready_to_publish" | "publishing")[] = [
      "validating",
      "planning",
      "generating",
      "scheduling",
      "ready_to_publish",
      "publishing",
    ];
    let lastPercent = -1;
    for (const s of states) {
      const p = runProgress(advanceTo(newRun(), s));
      expect(p.percent).toBeGreaterThanOrEqual(lastPercent);
      lastPercent = p.percent;
    }
  });

  test("completed reports 100%", () => {
    const p = runProgress(advanceTo(newRun(), "completed"));
    expect(p.percent).toBe(100);
    expect(p.terminal).toBe(true);
  });

  test("paused reports the resumeState's index, not paused", () => {
    const p = runProgress(advanceTo(newRun(), "paused", "scheduling"));
    expect(p.blocked).toBe(true);
    // scheduling is index 3 of 6 active steps → 50%
    expect(p.percent).toBeGreaterThan(0);
    expect(p.state).toBe("paused");
  });

  test("failed remembers the highest reached state", () => {
    let run = advanceTo(newRun(), "generating");
    run = (applyEvent(run, evt("error", {
      errorCode: "x",
      message: "y",
      recoverable: false,
      failureKind: "generation_failed",
    }), { now: () => T3 }) as { ok: true; run: AutonomousRun }).run;
    const p = runProgress(run);
    expect(p.terminal).toBe(true);
    // generating has been reached, so completedSteps >= index of generating
    expect(p.completedSteps).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/*                              Test fixtures                                 */
/* -------------------------------------------------------------------------- */

/**
 * Helper: advance a run through the canonical pipeline to a target state.
 * `via` (optional) selects the state to be in before transitioning to a
 * blocking state — used to control resumeState.
 */
function advanceTo(
  run: AutonomousRun,
  target: AutonomousRun["state"],
  via?: AutonomousRun["state"],
  options?: { retryBudget?: AutonomousRun["retryBudget"] },
): AutonomousRun {
  let cur = options?.retryBudget
    ? { ...run, retryBudget: options.retryBudget }
    : run;
  let now = T0;
  const tick = () => {
    const ms = Date.parse(now) + 1_000;
    now = new Date(ms).toISOString();
    return now;
  };
  const step = (
    fromState: AutonomousRun["state"],
    toState: AutonomousRun["state"],
  ): AutonomousRun => {
    const r = applyEvent(
      cur,
      evt("state_change", { fromState, toState, failureKind: null }),
      { now: tick },
    );
    if (!r.ok) throw new Error(`advanceTo step failed: ${fromState}→${toState}: ${r.reason}`);
    cur = r.run;
    return cur;
  };

  // Blocking states branch out FIRST so we don't double-step the active pipeline.
  if (target === "paused") {
    if (!via) throw new Error("advanceTo: 'paused' requires `via` parameter");
    cur = stepThroughActive(cur, step, via);
    const r = applyEvent(cur, evt("pause_requested"), { now: () => T2 });
    if (!r.ok) throw new Error(`pause from ${via} failed: ${r.reason}`);
    return r.run;
  }
  if (target === "awaiting_user") {
    if (!via)
      throw new Error("advanceTo: 'awaiting_user' requires `via` parameter");
    cur = stepThroughActive(cur, step, via);
    const r = applyEvent(
      cur,
      evt("state_change", {
        fromState: via,
        toState: "awaiting_user",
        failureKind: null,
      }),
      { now: () => T2 },
    );
    if (!r.ok)
      throw new Error(`awaiting_user from ${via} failed: ${r.reason}`);
    return r.run;
  }

  return stepThroughActive(cur, step, target);
}

/** Walk the linear active pipeline up to (and possibly into) target. */
function stepThroughActive(
  cur: AutonomousRun,
  step: (from: AutonomousRun["state"], to: AutonomousRun["state"]) => AutonomousRun,
  target: AutonomousRun["state"],
): AutonomousRun {
  if (target === "requested") return cur;
  cur = step("requested", "validating");
  if (target === "validating") return cur;
  cur = step("validating", "planning");
  if (target === "planning") return cur;
  cur = step("planning", "generating");
  if (target === "generating") return cur;
  cur = step("generating", "scheduling");
  if (target === "scheduling") return cur;
  cur = step("scheduling", "ready_to_publish");
  if (target === "ready_to_publish") return cur;
  cur = step("ready_to_publish", "publishing");
  if (target === "publishing") return cur;
  if (target === "completed") {
    cur = step("publishing", "completed");
    return cur;
  }
  throw new Error(
    `stepThroughActive: target ${target} is not in the active pipeline`,
  );
}
