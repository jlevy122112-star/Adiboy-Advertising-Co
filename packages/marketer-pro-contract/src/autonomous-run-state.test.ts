import { describe, expect, test } from "vitest";

import {
  AUTONOMOUS_RUN_FAILURE_KINDS,
  AUTONOMOUS_RUN_STATES,
  AutonomousRunFailureKindSchema,
  AutonomousRunStateSchema,
  canTransitionTo,
  isActiveState,
  isBlockingState,
  isStaleBlockingRun,
  isTerminalState,
  nextLegalStates,
  STALE_BLOCKING_RUN_MS,
  stateTimeoutMs,
  validateRunTransition,
  type AutonomousRunState,
} from "./autonomous-run-state.js";

const ALL_STATES = [...AUTONOMOUS_RUN_STATES] as AutonomousRunState[];

describe("AutonomousRunStateSchema", () => {
  test("accepts every canonical state", () => {
    for (const state of ALL_STATES) {
      expect(AutonomousRunStateSchema.parse(state)).toBe(state);
    }
  });

  test("rejects unknown values", () => {
    expect(() => AutonomousRunStateSchema.parse("running")).toThrow();
    expect(() => AutonomousRunStateSchema.parse("")).toThrow();
    expect(() => AutonomousRunStateSchema.parse(null)).toThrow();
    expect(() => AutonomousRunStateSchema.parse(42)).toThrow();
  });

  test("AUTONOMOUS_RUN_STATES has exactly 12 canonical entries", () => {
    expect(ALL_STATES).toHaveLength(12);
  });

  test("AUTONOMOUS_RUN_STATES has no duplicates", () => {
    const seen = new Set(ALL_STATES);
    expect(seen.size).toBe(ALL_STATES.length);
  });

  test("canonical lifecycle order: requested first, terminals last", () => {
    expect(ALL_STATES[0]).toBe("requested");
    expect(ALL_STATES.slice(-3).sort()).toEqual([
      "cancelled",
      "completed",
      "failed",
    ]);
  });
});

describe("state buckets", () => {
  test("every state belongs to exactly one bucket", () => {
    for (const state of ALL_STATES) {
      const buckets = [
        isActiveState(state),
        isBlockingState(state),
        isTerminalState(state),
      ].filter(Boolean);
      expect(buckets, `state ${state} bucket count`).toHaveLength(1);
    }
  });

  test("active bucket contains the seven runtime states", () => {
    const active = ALL_STATES.filter(isActiveState);
    expect(active).toEqual([
      "requested",
      "validating",
      "planning",
      "generating",
      "scheduling",
      "ready_to_publish",
      "publishing",
    ]);
  });

  test("blocking bucket is awaiting_user + paused only", () => {
    const blocking = ALL_STATES.filter(isBlockingState);
    expect(blocking.sort()).toEqual(["awaiting_user", "paused"]);
  });

  test("terminal bucket is completed + failed + cancelled only", () => {
    const terminal = ALL_STATES.filter(isTerminalState);
    expect(terminal.sort()).toEqual(["cancelled", "completed", "failed"]);
  });
});

describe("transition table — completeness", () => {
  test("every state has a defined transition list (including terminals = [])", () => {
    for (const state of ALL_STATES) {
      expect(() => nextLegalStates(state)).not.toThrow();
    }
  });

  test("every transition target is a valid AutonomousRunState", () => {
    for (const from of ALL_STATES) {
      for (const to of nextLegalStates(from)) {
        expect(ALL_STATES).toContain(to);
      }
    }
  });

  test("terminal states have empty transition lists", () => {
    expect(nextLegalStates("completed")).toEqual([]);
    expect(nextLegalStates("failed")).toEqual([]);
    expect(nextLegalStates("cancelled")).toEqual([]);
  });

  test("every non-terminal state has at least one outgoing transition", () => {
    for (const state of ALL_STATES) {
      if (isTerminalState(state)) continue;
      expect(
        nextLegalStates(state).length,
        `${state} should have at least one outgoing transition`,
      ).toBeGreaterThan(0);
    }
  });

  test("no state lists itself as a target (self-transitions banned)", () => {
    for (const state of ALL_STATES) {
      expect(nextLegalStates(state)).not.toContain(state);
    }
  });
});

describe("transition table — invariants", () => {
  test("cancelled is reachable from every non-terminal state", () => {
    for (const state of ALL_STATES) {
      if (isTerminalState(state)) continue;
      expect(
        canTransitionTo(state, "cancelled"),
        `${state} → cancelled should be allowed`,
      ).toBe(true);
    }
  });

  test("failed is reachable from every active state", () => {
    for (const state of ALL_STATES) {
      if (!isActiveState(state)) continue;
      if (state === "requested") continue;
      expect(
        canTransitionTo(state, "failed"),
        `${state} → failed should be allowed`,
      ).toBe(true);
    }
  });

  test("requested cannot fail directly — must validate first", () => {
    expect(canTransitionTo("requested", "failed")).toBe(false);
  });

  test("paused cannot transition to failed (only resume or cancel)", () => {
    expect(canTransitionTo("paused", "failed")).toBe(false);
    expect(canTransitionTo("paused", "cancelled")).toBe(true);
  });

  test("awaiting_user can re-enter all active runtime states", () => {
    const expectedResumeTargets: AutonomousRunState[] = [
      "planning",
      "generating",
      "scheduling",
      "ready_to_publish",
      "publishing",
    ];
    for (const target of expectedResumeTargets) {
      expect(
        canTransitionTo("awaiting_user", target),
        `awaiting_user → ${target}`,
      ).toBe(true);
    }
  });

  test("awaiting_user cannot resume into requested or validating", () => {
    expect(canTransitionTo("awaiting_user", "requested")).toBe(false);
    expect(canTransitionTo("awaiting_user", "validating")).toBe(false);
  });

  test("paused can re-enter the same set as awaiting_user", () => {
    const expectedResumeTargets: AutonomousRunState[] = [
      "planning",
      "generating",
      "scheduling",
      "ready_to_publish",
      "publishing",
      "awaiting_user",
    ];
    for (const target of expectedResumeTargets) {
      expect(canTransitionTo("paused", target), `paused → ${target}`).toBe(
        true,
      );
    }
  });

  test("publishing terminates only into completed, failed, or pause/await", () => {
    const targets = nextLegalStates("publishing").slice().sort();
    expect(targets).toEqual([
      "awaiting_user",
      "cancelled",
      "completed",
      "failed",
      "paused",
    ]);
  });

  test("validating may only proceed to planning, fail, or cancel", () => {
    const targets = nextLegalStates("validating").slice().sort();
    expect(targets).toEqual(["cancelled", "failed", "planning"]);
  });
});

describe("validateRunTransition", () => {
  test("returns ok for legal transitions", () => {
    expect(validateRunTransition("requested", "validating")).toEqual({
      ok: true,
    });
    expect(validateRunTransition("publishing", "completed")).toEqual({
      ok: true,
    });
  });

  test("rejects from-terminal with from_state_is_terminal", () => {
    expect(validateRunTransition("completed", "publishing")).toEqual({
      ok: false,
      reason: "from_state_is_terminal",
    });
    expect(validateRunTransition("failed", "publishing")).toEqual({
      ok: false,
      reason: "from_state_is_terminal",
    });
    expect(validateRunTransition("cancelled", "publishing")).toEqual({
      ok: false,
      reason: "from_state_is_terminal",
    });
  });

  test("rejects self-transition with self_transition_disallowed", () => {
    expect(validateRunTransition("planning", "planning")).toEqual({
      ok: false,
      reason: "self_transition_disallowed",
    });
  });

  test("self-transition rejection wins over transition_not_allowed for terminals when same state", () => {
    expect(validateRunTransition("completed", "completed")).toEqual({
      ok: false,
      reason: "from_state_is_terminal",
    });
  });

  test("rejects illegal non-terminal transitions with transition_not_allowed", () => {
    expect(validateRunTransition("requested", "publishing")).toEqual({
      ok: false,
      reason: "transition_not_allowed",
    });
    expect(validateRunTransition("validating", "completed")).toEqual({
      ok: false,
      reason: "transition_not_allowed",
    });
  });
});

describe("canTransitionTo — exhaustive 12×12 spot checks", () => {
  test("requested transitions exclusively to validating or cancelled", () => {
    for (const target of ALL_STATES) {
      const expected = target === "validating" || target === "cancelled";
      expect(canTransitionTo("requested", target)).toBe(expected);
    }
  });

  test("completed never transitions anywhere", () => {
    for (const target of ALL_STATES) {
      expect(canTransitionTo("completed", target)).toBe(false);
    }
  });

  test("failed never transitions anywhere", () => {
    for (const target of ALL_STATES) {
      expect(canTransitionTo("failed", target)).toBe(false);
    }
  });

  test("cancelled never transitions anywhere", () => {
    for (const target of ALL_STATES) {
      expect(canTransitionTo("cancelled", target)).toBe(false);
    }
  });
});

describe("AutonomousRunFailureKindSchema", () => {
  test("accepts every canonical failure kind", () => {
    for (const kind of AUTONOMOUS_RUN_FAILURE_KINDS) {
      expect(AutonomousRunFailureKindSchema.parse(kind)).toBe(kind);
    }
  });

  test("rejects unknown failure kinds", () => {
    expect(() => AutonomousRunFailureKindSchema.parse("oops")).toThrow();
    expect(() => AutonomousRunFailureKindSchema.parse("")).toThrow();
  });

  test("AUTONOMOUS_RUN_FAILURE_KINDS contains the 10 canonical kinds", () => {
    expect(AUTONOMOUS_RUN_FAILURE_KINDS).toHaveLength(10);
  });

  test("AUTONOMOUS_RUN_FAILURE_KINDS includes timeout + auth_lost + rate_limited_permanently", () => {
    expect(AUTONOMOUS_RUN_FAILURE_KINDS).toContain("timeout");
    expect(AUTONOMOUS_RUN_FAILURE_KINDS).toContain("auth_lost");
    expect(AUTONOMOUS_RUN_FAILURE_KINDS).toContain("rate_limited_permanently");
  });
});

describe("stateTimeoutMs", () => {
  test("active states have a positive numeric timeout", () => {
    for (const state of ALL_STATES) {
      if (!isActiveState(state)) continue;
      const t = stateTimeoutMs(state);
      expect(typeof t, `${state} timeout type`).toBe("number");
      expect(t, `${state} timeout value`).toBeGreaterThan(0);
    }
  });

  test("blocking and terminal states have null timeout", () => {
    for (const state of ALL_STATES) {
      if (isActiveState(state)) continue;
      expect(stateTimeoutMs(state), `${state} should have null timeout`).toBe(
        null,
      );
    }
  });

  test("planning timeout is 10 minutes", () => {
    expect(stateTimeoutMs("planning")).toBe(10 * 60 * 1000);
  });

  test("generating timeout is 30 minutes (longest active state)", () => {
    expect(stateTimeoutMs("generating")).toBe(30 * 60 * 1000);
  });

  test("ready_to_publish has a 24 h window for scheduled publishing", () => {
    expect(stateTimeoutMs("ready_to_publish")).toBe(24 * 60 * 60 * 1000);
  });

  test("validating has the shortest timeout (precondition check)", () => {
    expect(stateTimeoutMs("validating")).toBe(30_000);
  });
});

describe("STALE_BLOCKING_RUN_MS + isStaleBlockingRun", () => {
  test("STALE_BLOCKING_RUN_MS is exactly 7 days in ms", () => {
    expect(STALE_BLOCKING_RUN_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  test("returns false for active states regardless of elapsed time", () => {
    for (const state of ALL_STATES) {
      if (!isActiveState(state)) continue;
      expect(
        isStaleBlockingRun({
          state,
          enteredCurrentStateAt: 0,
          nowMs: STALE_BLOCKING_RUN_MS * 10,
        }),
        `${state} should never be stale-blocking`,
      ).toBe(false);
    }
  });

  test("returns false for terminal states regardless of elapsed time", () => {
    for (const state of ALL_STATES) {
      if (!isTerminalState(state)) continue;
      expect(
        isStaleBlockingRun({
          state,
          enteredCurrentStateAt: 0,
          nowMs: STALE_BLOCKING_RUN_MS * 10,
        }),
      ).toBe(false);
    }
  });

  test("returns true for awaiting_user past threshold", () => {
    expect(
      isStaleBlockingRun({
        state: "awaiting_user",
        enteredCurrentStateAt: 0,
        nowMs: STALE_BLOCKING_RUN_MS + 1,
      }),
    ).toBe(true);
  });

  test("returns true for paused past threshold", () => {
    expect(
      isStaleBlockingRun({
        state: "paused",
        enteredCurrentStateAt: 0,
        nowMs: STALE_BLOCKING_RUN_MS + 1,
      }),
    ).toBe(true);
  });

  test("returns false at exactly threshold (strictly greater)", () => {
    expect(
      isStaleBlockingRun({
        state: "paused",
        enteredCurrentStateAt: 0,
        nowMs: STALE_BLOCKING_RUN_MS,
      }),
    ).toBe(false);
  });

  test("returns false before threshold", () => {
    expect(
      isStaleBlockingRun({
        state: "awaiting_user",
        enteredCurrentStateAt: 1_000_000,
        nowMs: 1_000_000 + STALE_BLOCKING_RUN_MS - 1,
      }),
    ).toBe(false);
  });
});
