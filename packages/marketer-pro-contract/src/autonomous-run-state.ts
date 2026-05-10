/**
 * Autonomous run state machine — the canonical states a single autonomous
 * job (kicked off via `AutonomousJobRequest`) passes through, and the
 * transitions allowed between them.
 *
 * This module is **pure data + pure functions**. It declares the shape of
 * legal transitions but holds no run object — see `./autonomous-run.ts` for
 * the composite record and `./autonomous-run-events.ts` for the event
 * reducer that drives transitions.
 *
 * Why a state machine rather than ad-hoc booleans:
 *
 * 1. **The user's say is preserved at every block.** `awaiting_user` is a
 *    first-class state; the runtime must surface a notification plus
 *    decision UI before the AI proceeds. (This implements the product
 *    invariant: "every choice ... the user should have a say".)
 * 2. **Compliance / audit.** Every transition is event-sourced (see
 *    `./autonomous-run-events.ts`), so the audit log can answer the
 *    question "what did the AI do for me last week?".
 * 3. **Retries vs hard failures are explicit.** A failed publish on a
 *    single asset does not fail the whole run; only an exhausted retry
 *    budget at the run level transitions to `failed`.
 *
 * See README "Autonomous Run State Machine" for the visual diagram.
 */

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*                                  States                                    */
/* -------------------------------------------------------------------------- */

/**
 * All run states in canonical lifecycle order (active → blocking → terminal).
 *
 * | State               | Bucket    | Meaning                                   |
 * | ------------------- | --------- | ----------------------------------------- |
 * | requested           | active    | Created, not yet validated                |
 * | validating          | active    | Running precondition checks               |
 * | planning            | active    | AI laying out journey decisions           |
 * | awaiting_user       | blocking  | System needs a `user_only` decision       |
 * | generating          | active    | AI producing creative content             |
 * | scheduling          | active    | Computing publish dates                   |
 * | ready_to_publish    | active    | Queue loaded; awaiting publish trigger    |
 * | publishing          | active    | Publish jobs in flight                    |
 * | paused              | blocking  | User-initiated pause                      |
 * | completed           | terminal  | All assets published                      |
 * | failed              | terminal  | Permanent failure                         |
 * | cancelled           | terminal  | User-cancelled before completion          |
 */
export const AUTONOMOUS_RUN_STATES = [
  "requested",
  "validating",
  "planning",
  "awaiting_user",
  "generating",
  "scheduling",
  "ready_to_publish",
  "publishing",
  "paused",
  "completed",
  "failed",
  "cancelled",
] as const;

export type AutonomousRunState = (typeof AUTONOMOUS_RUN_STATES)[number];
export const AutonomousRunStateSchema = z.enum(AUTONOMOUS_RUN_STATES);

/* -------------------------------------------------------------------------- */
/*                              State buckets                                 */
/* -------------------------------------------------------------------------- */

const ACTIVE_STATES: ReadonlySet<AutonomousRunState> = new Set([
  "requested",
  "validating",
  "planning",
  "generating",
  "scheduling",
  "ready_to_publish",
  "publishing",
]);

const BLOCKING_STATES: ReadonlySet<AutonomousRunState> = new Set([
  "awaiting_user",
  "paused",
]);

const TERMINAL_STATES: ReadonlySet<AutonomousRunState> = new Set([
  "completed",
  "failed",
  "cancelled",
]);

/** End-of-life; no further transitions allowed. */
export function isTerminalState(state: AutonomousRunState): boolean {
  return TERMINAL_STATES.has(state);
}

/** Run is paused or waiting on user; needs intervention to make progress. */
export function isBlockingState(state: AutonomousRunState): boolean {
  return BLOCKING_STATES.has(state);
}

/** Run is doing real work: not blocked, not terminal. */
export function isActiveState(state: AutonomousRunState): boolean {
  return ACTIVE_STATES.has(state);
}

/* -------------------------------------------------------------------------- */
/*                              Transition table                              */
/* -------------------------------------------------------------------------- */

/**
 * Legal forward transitions. Reading: `from → set of allowed `to`.`
 *
 * - `awaiting_user` and `paused` re-enter most active states because
 *   resuming returns to whichever state the run was in before the block.
 *   The composite run record carries the `resume*State` field that drives
 *   that choice — this table only encodes legality.
 * - `cancelled` is reachable from every non-terminal state.
 * - `failed` is reachable from every non-terminal active state (retries
 *   exhausted / permanent error). It is also reachable from
 *   `awaiting_user` (e.g. user_only decision rejected outright) but **not**
 *   from `paused` (a paused run must be resumed or cancelled, never auto-
 *   failed without user action).
 */
const ALLOWED_TRANSITIONS: Readonly<
  Record<AutonomousRunState, ReadonlyArray<AutonomousRunState>>
> = Object.freeze({
  requested: ["validating", "cancelled"],
  validating: ["planning", "failed", "cancelled"],
  planning: ["generating", "awaiting_user", "paused", "failed", "cancelled"],
  generating: [
    "scheduling",
    "awaiting_user",
    "paused",
    "failed",
    "cancelled",
  ],
  scheduling: [
    "ready_to_publish",
    "awaiting_user",
    "paused",
    "failed",
    "cancelled",
  ],
  ready_to_publish: [
    "publishing",
    "awaiting_user",
    "paused",
    "failed",
    "cancelled",
  ],
  publishing: ["completed", "failed", "awaiting_user", "paused", "cancelled"],
  awaiting_user: [
    "planning",
    "generating",
    "scheduling",
    "ready_to_publish",
    "publishing",
    "paused",
    "failed",
    "cancelled",
  ],
  paused: [
    "planning",
    "generating",
    "scheduling",
    "ready_to_publish",
    "publishing",
    "awaiting_user",
    "cancelled",
  ],
  completed: [],
  failed: [],
  cancelled: [],
} satisfies Record<AutonomousRunState, ReadonlyArray<AutonomousRunState>>);

export function canTransitionTo(
  from: AutonomousRunState,
  to: AutonomousRunState,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function nextLegalStates(
  from: AutonomousRunState,
): ReadonlyArray<AutonomousRunState> {
  return ALLOWED_TRANSITIONS[from];
}

/* -------------------------------------------------------------------------- */
/*                          Transition validation                             */
/* -------------------------------------------------------------------------- */

export type TransitionRejectionReason =
  | "from_state_is_terminal"
  | "transition_not_allowed"
  | "self_transition_disallowed";

export type TransitionValidationResult =
  | { ok: true }
  | { ok: false; reason: TransitionRejectionReason };

/**
 * Cross-validate a `from → to` transition. Returns a tagged result so the
 * runtime can render a specific error rather than a generic
 * "illegal transition".
 */
export function validateRunTransition(
  from: AutonomousRunState,
  to: AutonomousRunState,
): TransitionValidationResult {
  if (isTerminalState(from)) {
    return { ok: false, reason: "from_state_is_terminal" };
  }
  if (from === to) {
    return { ok: false, reason: "self_transition_disallowed" };
  }
  if (!canTransitionTo(from, to)) {
    return { ok: false, reason: "transition_not_allowed" };
  }
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*                              Failure kinds                                 */
/* -------------------------------------------------------------------------- */

/**
 * Reason a run transitioned into `failed`. The audit log records this so
 * the user can see *why* the AI bailed out, not just *that* it did.
 */
export const AUTONOMOUS_RUN_FAILURE_KINDS = [
  "validation_failed",
  "planning_failed",
  "generation_failed",
  "scheduling_failed",
  "publishing_failed",
  "timeout",
  "internal_error",
  "rate_limited_permanently",
  "auth_lost",
  "policy_changed_mid_run",
] as const;

export type AutonomousRunFailureKind =
  (typeof AUTONOMOUS_RUN_FAILURE_KINDS)[number];
export const AutonomousRunFailureKindSchema = z.enum(
  AUTONOMOUS_RUN_FAILURE_KINDS,
);

/* -------------------------------------------------------------------------- */
/*                              State timeouts                                */
/* -------------------------------------------------------------------------- */

/**
 * Maximum time (ms) a run may spend in a given state before the runtime
 * marks it stuck and emits a timeout event. `null` means "no timeout".
 *
 * `awaiting_user` and `paused` are user-driven; we never auto-fail them.
 * The UI surfaces a "stale run" advisory after `STALE_BLOCKING_RUN_MS`
 * (see {@link STALE_BLOCKING_RUN_MS}) but the run never auto-cancels.
 */
const STATE_TIMEOUTS_MS: Readonly<
  Record<AutonomousRunState, number | null>
> = Object.freeze({
  requested: 60_000, // 1 min — should pick up the run quickly
  validating: 30_000, // 30 s — pure precondition check
  planning: 10 * 60_000, // 10 min — AI strategy pass
  generating: 30 * 60_000, // 30 min — image + copy + design generation
  scheduling: 60_000, // 1 min — computing dates is cheap
  ready_to_publish: 24 * 60 * 60_000, // 24 h — windowed publish
  publishing: 60 * 60_000, // 1 h — all platforms attempted
  awaiting_user: null,
  paused: null,
  completed: null,
  failed: null,
  cancelled: null,
});

export function stateTimeoutMs(state: AutonomousRunState): number | null {
  return STATE_TIMEOUTS_MS[state];
}

/**
 * Threshold (ms) after which the UI should advise the user that a blocking
 * run has gone stale. **Advisory only** — the runtime never auto-cancels a
 * paused or awaiting-user run.
 */
export const STALE_BLOCKING_RUN_MS = 7 * 24 * 60 * 60_000; // 7 days

/**
 * True when an `awaiting_user` or `paused` run has been blocking longer
 * than {@link STALE_BLOCKING_RUN_MS}. Pass the timestamp the run entered
 * the current state for `enteredCurrentStateAt`.
 */
export function isStaleBlockingRun(args: {
  readonly state: AutonomousRunState;
  readonly enteredCurrentStateAt: number;
  readonly nowMs: number;
}): boolean {
  if (!isBlockingState(args.state)) return false;
  return args.nowMs - args.enteredCurrentStateAt > STALE_BLOCKING_RUN_MS;
}
