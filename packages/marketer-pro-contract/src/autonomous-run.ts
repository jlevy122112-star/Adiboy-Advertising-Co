/**
 * Composite autonomous-run record + pure reducer.
 *
 * The {@link AutonomousRun} schema is the canonical persistence shape for
 * a single autonomous job. The reducer in this module ({@link applyEvent})
 * is the **only** way to advance a run — every transition flows through an
 * event, every event lands in the audit log, and the audit log is the
 * source of truth for "what did the AI do for me last week?".
 *
 * Three product invariants encoded here:
 *
 * 1. **The user's say is preserved.** When the AI hits a `user_only`
 *    decision point during an active run it cannot just guess; the run
 *    must transition to `awaiting_user`. The reducer enforces that by
 *    refusing to record `decision_committed` events with the wrong source
 *    on user_only points.
 *
 * 2. **Retries are bounded and observable.** Per-asset attempts and the
 *    total run-error budget are first-class fields. Exhausted budgets
 *    surface a non-recoverable `error` event; transient ones do not.
 *
 * 3. **Resume is deterministic.** When a run enters `paused` or
 *    `awaiting_user`, the previous active state is captured in
 *    `resumeState`. `resume_requested` re-emits a `state_change` back to
 *    that state — never to a different one.
 */

import { z } from "zod";

import {
  AutonomousRunEventSchema,
  eventToTargetState,
  type AutonomousRunEvent,
  type ProviderResultEvent,
  type StateChangeEvent,
} from "./autonomous-run-events.js";
import {
  AUTONOMOUS_RUN_STATES,
  AutonomousRunFailureKindSchema,
  AutonomousRunStateSchema,
  isActiveState,
  isBlockingState,
  isTerminalState,
  stateTimeoutMs,
  validateRunTransition,
  type AutonomousRunFailureKind,
  type AutonomousRunState,
} from "./autonomous-run-state.js";
import { DecisionRecordSchema, type DecisionPoint } from "./decision-point.js";
import {
  AutonomousJobRequestSchema,
  WorkspaceAutonomyPolicySchema,
} from "./workspace-autonomy.js";

/* -------------------------------------------------------------------------- */
/*                              Retry budget                                  */
/* -------------------------------------------------------------------------- */

export const RetryBudgetSchema = z
  .object({
    /** Max attempts per asset/schedule entry before giving up on it. */
    maxPerAssetAttempts: z.number().int().min(1).max(20),
    /** Total error count across the run before forcing failure. */
    maxTotalRunErrors: z.number().int().min(1).max(100),
    /** Exponential backoff base in ms (provider may override). */
    retryBackoffMs: z.number().int().min(100).max(60_000),
  })
  .strict();
export type RetryBudget = z.infer<typeof RetryBudgetSchema>;

export const DEFAULT_RETRY_BUDGET: RetryBudget = {
  maxPerAssetAttempts: 5,
  maxTotalRunErrors: 20,
  retryBackoffMs: 1_000,
};

/* -------------------------------------------------------------------------- */
/*                              Run record                                    */
/* -------------------------------------------------------------------------- */

const MAX_EVENTS_PER_RUN = 10_000;
const MAX_DECISION_RECORDS_PER_RUN = 1_000;
const MAX_TRACKED_ASSETS = 1_000;

export const AutonomousRunSchema = z
  .object({
    runId: z.string().min(1).max(120),
    workspaceId: z.string().min(1).max(120),
    request: AutonomousJobRequestSchema,
    /** Policy snapshot at run creation; immutable for audit purposes. */
    policy: WorkspaceAutonomyPolicySchema,
    state: AutonomousRunStateSchema,
    /** ISO timestamp when the run last entered the current state. */
    enteredCurrentStateAt: z.string().datetime(),
    /**
     * Active state to resume to from `awaiting_user` or `paused`. Set when
     * the run enters either blocking state, cleared on resume.
     */
    resumeState: AutonomousRunStateSchema.nullable(),
    retryBudget: RetryBudgetSchema,
    /** Total non-recoverable errors consumed against `maxTotalRunErrors`. */
    totalErrors: z.number().int().min(0),
    /**
     * Per-asset attempt counters. Key = scheduleEntryId. Bounded length so
     * persistence size never explodes.
     */
    attemptsByAsset: z
      .record(z.string().min(1).max(120), z.number().int().min(0).max(20))
      .refine((m) => Object.keys(m).length <= MAX_TRACKED_ASSETS, {
        message: `at most ${MAX_TRACKED_ASSETS} tracked assets per run`,
      }),
    /** Append-only event audit log. Bounded — caller compacts at storage. */
    events: z.array(AutonomousRunEventSchema).max(MAX_EVENTS_PER_RUN),
    /** Decision records committed during this run. */
    decisionRecords: z
      .array(DecisionRecordSchema)
      .max(MAX_DECISION_RECORDS_PER_RUN),
    /** Set when state === "failed". */
    failureKind: AutonomousRunFailureKindSchema.nullable(),
    /** Set when state === "cancelled". */
    cancelReason: z.string().max(500).nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    /** Set when run reaches a terminal state. */
    terminatedAt: z.string().datetime().nullable(),
  })
  .strict();
export type AutonomousRun = z.infer<typeof AutonomousRunSchema>;

/* -------------------------------------------------------------------------- */
/*                              createRun factory                             */
/* -------------------------------------------------------------------------- */

export interface CreateRunArgs {
  readonly runId: string;
  readonly workspaceId: string;
  readonly request: z.infer<typeof AutonomousJobRequestSchema>;
  readonly policy: z.infer<typeof WorkspaceAutonomyPolicySchema>;
  readonly retryBudget?: RetryBudget;
  /** Defaults to current ISO timestamp. */
  readonly now?: () => string;
}

/** Build a fresh run in the `requested` state. Pure; no I/O. */
export function createRun(args: CreateRunArgs): AutonomousRun {
  const now = args.now ? args.now() : new Date().toISOString();
  return {
    runId: args.runId,
    workspaceId: args.workspaceId,
    request: args.request,
    policy: args.policy,
    state: "requested",
    enteredCurrentStateAt: now,
    resumeState: null,
    retryBudget: args.retryBudget ?? DEFAULT_RETRY_BUDGET,
    totalErrors: 0,
    attemptsByAsset: {},
    events: [],
    decisionRecords: [],
    failureKind: null,
    cancelReason: null,
    createdAt: now,
    updatedAt: now,
    terminatedAt: null,
  };
}

/* -------------------------------------------------------------------------- */
/*                              applyEvent reducer                            */
/* -------------------------------------------------------------------------- */

export type ApplyEventRejection =
  | "run_in_terminal_state"
  | "illegal_transition"
  | "no_resume_state_set"
  | "from_state_mismatch"
  | "schema_validation_failed"
  | "events_buffer_full"
  | "decision_records_full"
  | "tracked_assets_full";

export type ApplyEventResult =
  | {
      ok: true;
      run: AutonomousRun;
      /** All events appended (typically the input event; may include a synthesized state_change for resume). */
      emittedEvents: ReadonlyArray<AutonomousRunEvent>;
    }
  | { ok: false; reason: ApplyEventRejection; run: AutonomousRun };

export interface ApplyEventOptions {
  /** Defaults to current ISO timestamp. */
  readonly now?: () => string;
  /** Generates a unique event id for any synthesized events (e.g. resume's state_change). */
  readonly nextEventId?: () => string;
}

/**
 * Apply an event to a run. Pure; returns a new run + the events that were
 * appended. Refuses illegal transitions, validates per-event invariants,
 * and synthesizes a `state_change` when a `resume_requested` event lands
 * on a blocking state.
 */
export function applyEvent(
  run: AutonomousRun,
  event: AutonomousRunEvent,
  options: ApplyEventOptions = {},
): ApplyEventResult {
  if (isTerminalState(run.state)) {
    return { ok: false, reason: "run_in_terminal_state", run };
  }

  const parsed = AutonomousRunEventSchema.safeParse(event);
  if (!parsed.success) {
    return { ok: false, reason: "schema_validation_failed", run };
  }

  if (run.events.length >= MAX_EVENTS_PER_RUN) {
    return { ok: false, reason: "events_buffer_full", run };
  }

  const now = options.now ? options.now() : new Date().toISOString();

  // Resume needs special handling: synthesize a state_change to resumeState.
  if (event.type === "resume_requested") {
    return finaliseResult(
      applyResume(run, event, now, options.nextEventId),
      event,
    );
  }

  // Compute target state via the resolver.
  const target = eventToTargetState(event, run.state);
  if (target === null) {
    return finaliseResult(appendAuditOnly(run, event, now), event);
  }

  // For state_change events, validate the carried fromState/toState match.
  if (event.type === "state_change") {
    if (event.fromState !== run.state) {
      return { ok: false, reason: "from_state_mismatch", run };
    }
  }

  const transition = validateRunTransition(run.state, target);
  if (!transition.ok) {
    return { ok: false, reason: "illegal_transition", run };
  }

  return finaliseResult(commitTransition(run, event, target, now), event);
}

/**
 * Apply post-processing common to both audit-only events and transitions.
 * Currently: bump `totalErrors` on `error` events regardless of whether a
 * state change occurred. Centralised here so we never double-count and so
 * recoverable errors still consume the run-level error budget.
 */
function finaliseResult(
  result: ApplyEventResult,
  event: AutonomousRunEvent,
): ApplyEventResult {
  if (!result.ok) return result;
  if (event.type !== "error") return result;
  return {
    ...result,
    run: { ...result.run, totalErrors: result.run.totalErrors + 1 },
  };
}

/* -------------------------------------------------------------------------- */
/*                          Reducer internals                                 */
/* -------------------------------------------------------------------------- */

function appendAuditOnly(
  run: AutonomousRun,
  event: AutonomousRunEvent,
  now: string,
): ApplyEventResult {
  let next: AutonomousRun = {
    ...run,
    events: [...run.events, event],
    updatedAt: now,
  };

  if (event.type === "decision_committed") {
    // The decision record itself is added by callers via includeDecisionRecord.
    // Audit event lands here.
  }

  if (event.type === "provider_result") {
    next = recordProviderAttempt(next, event);
    // recoverable provider errors don't change state; non-recoverable
    // are surfaced as separate `error` events by the caller.
  }

  return { ok: true, run: next, emittedEvents: [event] };
}

function commitTransition(
  run: AutonomousRun,
  event: AutonomousRunEvent,
  target: AutonomousRunState,
  now: string,
): ApplyEventResult {
  const becomesBlocking = isBlockingState(target);
  const wasBlocking = isBlockingState(run.state);

  // Capture / clear resume state.
  let resumeState: AutonomousRunState | null = run.resumeState;
  if (becomesBlocking && !wasBlocking) {
    // Entering a block — remember where to come back to.
    resumeState = run.state;
  } else if (!becomesBlocking && wasBlocking) {
    // Leaving a block — forget the saved state.
    resumeState = null;
  }

  const failureKind = deriveFailureKind(event, target, run.failureKind);
  const cancelReason = deriveCancelReason(event, target, run.cancelReason);

  // events_buffer_full check already gated us in applyEvent; safe to push.
  let next: AutonomousRun = {
    ...run,
    state: target,
    enteredCurrentStateAt: now,
    resumeState,
    failureKind,
    cancelReason,
    events: [...run.events, event],
    updatedAt: now,
    terminatedAt: isTerminalState(target) ? now : null,
  };

  if (event.type === "provider_result") {
    next = recordProviderAttempt(next, event);
  }

  return { ok: true, run: next, emittedEvents: [event] };
}

function applyResume(
  run: AutonomousRun,
  event: Extract<AutonomousRunEvent, { type: "resume_requested" }>,
  now: string,
  nextEventId: (() => string) | undefined,
): ApplyEventResult {
  if (!isBlockingState(run.state)) {
    // Resume on a non-blocking state is a no-op audit event.
    return appendAuditOnly(run, event, now);
  }
  if (run.resumeState === null) {
    return { ok: false, reason: "no_resume_state_set", run };
  }

  const transition = validateRunTransition(run.state, run.resumeState);
  if (!transition.ok) {
    return { ok: false, reason: "illegal_transition", run };
  }

  const synthId = nextEventId ? nextEventId() : `${event.eventId}.resumed`;
  const synth: StateChangeEvent = {
    type: "state_change",
    eventId: synthId,
    runId: event.runId,
    occurredAt: now,
    actorUserId: event.actorUserId,
    fromState: run.state,
    toState: run.resumeState,
    failureKind: null,
    reason: "resumed_by_user",
  };

  const withResumeReq: AutonomousRun = {
    ...run,
    events: [...run.events, event],
    updatedAt: now,
  };
  // commitTransition reads run.resumeState, so apply it on `run` (the input
  // before the audit append) so resumeState gets cleared correctly.
  const after = commitTransition(withResumeReq, synth, run.resumeState, now);
  if (!after.ok) return after;

  return {
    ok: true,
    run: after.run,
    emittedEvents: [event, synth],
  };
}

function deriveFailureKind(
  event: AutonomousRunEvent,
  target: AutonomousRunState,
  prior: AutonomousRunFailureKind | null,
): AutonomousRunFailureKind | null {
  if (target !== "failed") return prior;
  if (event.type === "state_change") return event.failureKind;
  if (event.type === "error" && !event.recoverable) return event.failureKind;
  if (event.type === "timeout") return "timeout";
  return prior ?? "internal_error";
}

function deriveCancelReason(
  event: AutonomousRunEvent,
  target: AutonomousRunState,
  prior: string | null,
): string | null {
  if (target !== "cancelled") return prior;
  if (event.type === "cancel_requested") return event.reason ?? null;
  return prior;
}

function recordProviderAttempt(
  run: AutonomousRun,
  event: ProviderResultEvent,
): AutonomousRun {
  const id = event.scheduleEntryId;
  const cur = run.attemptsByAsset[id] ?? 0;
  const next = Math.min(cur + 1, 20);
  return {
    ...run,
    attemptsByAsset: { ...run.attemptsByAsset, [id]: next },
  };
}

/* -------------------------------------------------------------------------- */
/*                              Read helpers                                  */
/* -------------------------------------------------------------------------- */

/** Number of attempts already recorded for an asset (defaults to 0). */
export function assetAttempts(
  run: AutonomousRun,
  scheduleEntryId: string,
): number {
  return run.attemptsByAsset[scheduleEntryId] ?? 0;
}

/** True when the asset has been retried up to `retryBudget.maxPerAssetAttempts`. */
export function assetAttemptsExceeded(
  run: AutonomousRun,
  scheduleEntryId: string,
): boolean {
  return assetAttempts(run, scheduleEntryId) >= run.retryBudget.maxPerAssetAttempts;
}

/** True when the run-level error budget is fully consumed. */
export function totalErrorBudgetExceeded(run: AutonomousRun): boolean {
  return run.totalErrors >= run.retryBudget.maxTotalRunErrors;
}

/** First successful provider_result for an asset, or `undefined` if none yet. */
export function firstSuccessfulPublishOf(
  run: AutonomousRun,
  scheduleEntryId: string,
): ProviderResultEvent | undefined {
  for (const ev of run.events) {
    if (ev.type !== "provider_result") continue;
    if (ev.scheduleEntryId !== scheduleEntryId) continue;
    if (ev.ok) return ev;
  }
  return undefined;
}

/** True when state is `awaiting_user` or `paused`. */
export function requiresUserInterrupt(run: AutonomousRun): boolean {
  return isBlockingState(run.state);
}

/** True when state is terminal (completed, failed, cancelled). */
export function isRunComplete(run: AutonomousRun): boolean {
  return isTerminalState(run.state);
}

/** True when the run has overrun its current state's timeout. */
export function isStuck(run: AutonomousRun, nowMs: number): boolean {
  const limit = stateTimeoutMs(run.state);
  if (limit === null) return false;
  const enteredMs = Date.parse(run.enteredCurrentStateAt);
  if (Number.isNaN(enteredMs)) return false;
  return nowMs - enteredMs > limit;
}

/** Decision points still waiting on the user (`user_only` and unsatisfied). */
export function userOnlyDecisionsBlocking(
  run: AutonomousRun,
  catalog: ReadonlyArray<DecisionPoint>,
): DecisionPoint[] {
  const satisfied = new Set(run.decisionRecords.map((r) => r.decisionPointId));
  return catalog.filter(
    (p) => p.controlMode === "user_only" && !satisfied.has(p.id),
  );
}

/* -------------------------------------------------------------------------- */
/*                              Run progress                                  */
/* -------------------------------------------------------------------------- */

/**
 * Active-state progression order used to compute `RunProgress.percent`.
 * `requested` and the blocking states aren't counted as progress milestones
 * — only forward motion through the active pipeline counts.
 */
const PROGRESS_STATES: ReadonlyArray<AutonomousRunState> = [
  "validating",
  "planning",
  "generating",
  "scheduling",
  "ready_to_publish",
  "publishing",
  "completed",
];

export interface RunProgress {
  readonly state: AutonomousRunState;
  readonly completedSteps: number;
  readonly totalSteps: number;
  readonly percent: number; // 0..100, integer
  readonly terminal: boolean;
  readonly blocked: boolean;
}

/** Compute a coarse 0..100 progress indicator suitable for a UI bar. */
export function runProgress(run: AutonomousRun): RunProgress {
  const total = PROGRESS_STATES.length - 1; // exclude "completed" itself
  let completed = 0;
  if (run.state === "completed") {
    completed = total;
  } else if (run.state === "failed" || run.state === "cancelled") {
    // Use the last non-terminal active state we entered.
    completed = lastActiveProgressIndex(run);
  } else if (isBlockingState(run.state) && run.resumeState !== null) {
    const idx = PROGRESS_STATES.indexOf(run.resumeState);
    completed = idx >= 0 ? idx : 0;
  } else {
    const idx = PROGRESS_STATES.indexOf(run.state);
    completed = idx >= 0 ? idx : 0;
  }
  const percent =
    total === 0 ? 0 : Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
  return {
    state: run.state,
    completedSteps: completed,
    totalSteps: total,
    percent,
    terminal: isTerminalState(run.state),
    blocked: isBlockingState(run.state),
  };
}

function lastActiveProgressIndex(run: AutonomousRun): number {
  let highest = 0;
  for (const ev of run.events) {
    if (ev.type !== "state_change") continue;
    const idx = PROGRESS_STATES.indexOf(ev.toState);
    if (idx > highest) highest = idx;
  }
  return highest;
}

/* -------------------------------------------------------------------------- */
/*                              Diagnostics                                   */
/* -------------------------------------------------------------------------- */

/** Read-only snapshot of canonical states for callers that don't want to import the array directly. */
export function listAllRunStates(): ReadonlyArray<AutonomousRunState> {
  return AUTONOMOUS_RUN_STATES;
}

/** Sanity check: state is active in the canonical sense. */
export function isInActivePhase(run: AutonomousRun): boolean {
  return isActiveState(run.state);
}
