/**
 * Autonomous run events — the append-only audit stream for a single
 * autonomous job. Every state change, decision commit, provider response,
 * notification, and user action lands here.
 *
 * Two design choices:
 *
 * 1. **Discriminated union by `type`.** Each event type carries its own
 *    payload; consumers pattern-match exhaustively. Zod's
 *    `discriminatedUnion` enforces the discriminator at parse time, so a
 *    malformed event fails fast at the API boundary.
 *
 * 2. **`eventToTargetState` is a pure resolver, not a reducer.** It
 *    answers "if this event is applied to a run currently in state X,
 *    what state should the run move to (or null if no transition)?". The
 *    composite reducer in {@link ./autonomous-run.ts} owns side-effects
 *    like decrementing retry budgets, appending decision records, and
 *    figuring out resume targets after `paused` / `awaiting_user`.
 *
 * Why audit-only events live here: the campaign-level decision aggregator
 * (Phase 1D.C) needs to read this stream alongside the broader Decision
 * Audit Log. Keeping every meaningful runtime event in one shape simplifies
 * downstream consumers.
 */

import { z } from "zod";

import {
  AutonomousRunFailureKindSchema,
  AutonomousRunStateSchema,
  isActiveState,
  isTerminalState,
  type AutonomousRunState,
} from "./autonomous-run-state.js";
import {
  DecisionControlModeSchema,
  DecisionSourceSchema,
} from "./decision-point.js";
import { PublishableNetworkSchema } from "./social-connections.js";
import {
  NotificationChannelSchema,
  NotificationReasonSchema,
} from "./workspace-autonomy.js";

/* -------------------------------------------------------------------------- */
/*                             Event type roster                              */
/* -------------------------------------------------------------------------- */

export const AUTONOMOUS_RUN_EVENT_TYPES = [
  "state_change",
  "decision_committed",
  "provider_result",
  "user_override",
  "timeout",
  "error",
  "cancel_requested",
  "pause_requested",
  "resume_requested",
  "notification_sent",
] as const;

export type AutonomousRunEventType =
  (typeof AUTONOMOUS_RUN_EVENT_TYPES)[number];

export const AutonomousRunEventTypeSchema = z.enum(
  AUTONOMOUS_RUN_EVENT_TYPES,
);

/* -------------------------------------------------------------------------- */
/*                              Shared metadata                               */
/* -------------------------------------------------------------------------- */

const baseEventFields = {
  eventId: z.string().min(1).max(120),
  runId: z.string().min(1).max(120),
  occurredAt: z.string().datetime(),
  /** User responsible for the action; `null` when the event was emitted by the system. */
  actorUserId: z.string().min(1).max(120).nullable(),
} as const;

/* -------------------------------------------------------------------------- */
/*                              Event schemas                                 */
/* -------------------------------------------------------------------------- */

export const StateChangeEventSchema = z
  .object({
    ...baseEventFields,
    type: z.literal("state_change"),
    fromState: AutonomousRunStateSchema,
    toState: AutonomousRunStateSchema,
    reason: z.string().max(500).optional(),
    /** Required when `toState === "failed"`; null otherwise. */
    failureKind: AutonomousRunFailureKindSchema.nullable(),
  })
  .strict()
  .refine(
    (e) => (e.toState === "failed" ? e.failureKind !== null : true),
    {
      message: "failureKind required when toState is 'failed'",
      path: ["failureKind"],
    },
  )
  .refine((e) => e.fromState !== e.toState, {
    message: "state_change must move to a different state",
    path: ["toState"],
  });
export type StateChangeEvent = z.infer<typeof StateChangeEventSchema>;

export const DecisionCommittedEventSchema = z
  .object({
    ...baseEventFields,
    type: z.literal("decision_committed"),
    decisionRecordId: z.string().min(1).max(120),
    decisionPointId: z.string().min(1).max(120),
    source: DecisionSourceSchema,
    controlMode: DecisionControlModeSchema,
    /** ISO timestamp the decision was made (mirrors the record's committedAt). */
    committedAt: z.string().datetime(),
  })
  .strict();
export type DecisionCommittedEvent = z.infer<
  typeof DecisionCommittedEventSchema
>;

export const ProviderResultEventSchema = z
  .object({
    ...baseEventFields,
    type: z.literal("provider_result"),
    network: PublishableNetworkSchema,
    scheduleEntryId: z.string().min(1).max(120),
    ok: z.boolean(),
    externalId: z.string().min(1).max(500).nullable(),
    detail: z.string().max(2000).nullable(),
    /** Attempt number that produced this result (1-based). */
    attempt: z.number().int().min(1).max(20),
    /** Optional retry hint (ms) returned by the provider for transient failures. */
    nextRetryAfterMs: z.number().int().min(0).max(86_400_000).optional(),
  })
  .strict();
export type ProviderResultEvent = z.infer<typeof ProviderResultEventSchema>;

export const UserOverrideEventSchema = z
  .object({
    ...baseEventFields,
    type: z.literal("user_override"),
    decisionPointId: z.string().min(1).max(120),
    previousRecordId: z.string().min(1).max(120),
    newRecordId: z.string().min(1).max(120),
  })
  .strict();
export type UserOverrideEvent = z.infer<typeof UserOverrideEventSchema>;

export const TimeoutEventSchema = z
  .object({
    ...baseEventFields,
    type: z.literal("timeout"),
    state: AutonomousRunStateSchema,
    enteredAt: z.string().datetime(),
    expectedTimeoutMs: z.number().int().min(1).max(7 * 24 * 60 * 60_000),
  })
  .strict();
export type TimeoutEvent = z.infer<typeof TimeoutEventSchema>;

export const ErrorEventSchema = z
  .object({
    ...baseEventFields,
    type: z.literal("error"),
    errorCode: z.string().min(1).max(120),
    message: z.string().min(1).max(2000),
    /** When `false`, the run will transition to `failed` after this event. */
    recoverable: z.boolean(),
    failureKind: AutonomousRunFailureKindSchema.nullable(),
  })
  .strict()
  .refine((e) => (e.recoverable ? true : e.failureKind !== null), {
    message: "failureKind required when error is non-recoverable",
    path: ["failureKind"],
  });
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;

export const CancelRequestedEventSchema = z
  .object({
    ...baseEventFields,
    type: z.literal("cancel_requested"),
    reason: z.string().max(500).optional(),
  })
  .strict();
export type CancelRequestedEvent = z.infer<typeof CancelRequestedEventSchema>;

export const PauseRequestedEventSchema = z
  .object({
    ...baseEventFields,
    type: z.literal("pause_requested"),
    reason: z.string().max(500).optional(),
  })
  .strict();
export type PauseRequestedEvent = z.infer<typeof PauseRequestedEventSchema>;

export const ResumeRequestedEventSchema = z
  .object({
    ...baseEventFields,
    type: z.literal("resume_requested"),
  })
  .strict();
export type ResumeRequestedEvent = z.infer<typeof ResumeRequestedEventSchema>;

export const NotificationSentEventSchema = z
  .object({
    ...baseEventFields,
    type: z.literal("notification_sent"),
    reason: NotificationReasonSchema,
    channels: z.array(NotificationChannelSchema).min(1).max(4),
    /**
     * Optional sha256 hex digest of the rendered payload — recorded so the
     * audit trail can confirm "this notification went out" without storing
     * the message body itself (PII).
     */
    payloadDigest: z
      .string()
      .regex(/^[a-f0-9]{64}$/i, "must be sha256 hex")
      .optional(),
  })
  .strict();
export type NotificationSentEvent = z.infer<
  typeof NotificationSentEventSchema
>;

/* -------------------------------------------------------------------------- */
/*                              Discriminated union                           */
/* -------------------------------------------------------------------------- */

/**
 * Discriminated union of every event a run can emit. Use
 * `AutonomousRunEventSchema.parse(json)` at every API/queue boundary so
 * downstream consumers can pattern-match `event.type` exhaustively.
 *
 * NOTE: schemas with `.refine()` cannot be members of `z.discriminatedUnion`
 * because Zod can't see through the refinement to the literal tag, so this
 * union uses `z.union` and we expose `EVENT_SCHEMAS_BY_TYPE` for explicit
 * runtime validation per-type.
 */
export const AutonomousRunEventSchema = z.union([
  StateChangeEventSchema,
  DecisionCommittedEventSchema,
  ProviderResultEventSchema,
  UserOverrideEventSchema,
  TimeoutEventSchema,
  ErrorEventSchema,
  CancelRequestedEventSchema,
  PauseRequestedEventSchema,
  ResumeRequestedEventSchema,
  NotificationSentEventSchema,
]);
export type AutonomousRunEvent = z.infer<typeof AutonomousRunEventSchema>;

/* -------------------------------------------------------------------------- */
/*                          Event → state resolver                            */
/* -------------------------------------------------------------------------- */

/**
 * Pure resolver: given an event applied to a run currently in
 * `currentState`, what state should the run move to?
 *
 * Returns `null` when the event is audit-only (does not drive a transition)
 * or when the event has no legal target from this state. The composite
 * reducer in {@link ./autonomous-run.ts} layers retry-budget,
 * resume-from-state, and decision-record bookkeeping on top.
 *
 * Resume semantics:
 * - `resume_requested` returns `null` here because the resume target is
 *   the run's stored `resumeFromState`, which the events module does not
 *   know about. The composite reducer reads it and emits a corresponding
 *   `state_change` event. NOTE: this `null` is a layering artifact, not a
 *   classification — `resume_requested` IS a transition-driving event;
 *   see {@link isAuditOnlyEvent} and {@link eventCausesStateChange}.
 */
export function eventToTargetState(
  event: AutonomousRunEvent,
  currentState: AutonomousRunState,
): AutonomousRunState | null {
  if (isTerminalState(currentState)) return null;

  switch (event.type) {
    case "state_change":
      return event.toState;
    case "cancel_requested":
      return "cancelled";
    case "pause_requested":
      return isActiveState(currentState) ? "paused" : null;
    case "resume_requested":
      return null;
    case "timeout":
      return "failed";
    case "error":
      return event.recoverable ? null : "failed";
    case "decision_committed":
    case "user_override":
    case "provider_result":
    case "notification_sent":
      return null;
  }
}

/**
 * True when the event, if applied at `currentState`, would change the run
 * state. Convenience for the composite reducer.
 *
 * Note: this asks a per-(event, state) question and uses the pure
 * resolver. For `resume_requested`, this returns `false` from this module
 * even though the composite reducer in `./autonomous-run.ts` will produce
 * a synthesized `state_change` when applied to a blocking state. Callers
 * that need the runtime answer should use the composite reducer's
 * `applyEvent` and inspect the returned `run.state`.
 */
export function eventCausesStateChange(
  event: AutonomousRunEvent,
  currentState: AutonomousRunState,
): boolean {
  return eventToTargetState(event, currentState) !== null;
}

/**
 * True when the event is an audit-only entry — i.e. one that **never**
 * drives a state transition under any circumstance, including via the
 * composite reducer in {@link ./autonomous-run.ts}.
 *
 * `resume_requested` is **not** audit-only: when applied to a blocking
 * state (`paused` / `awaiting_user`), the composite reducer synthesizes a
 * `state_change` back to the saved `resumeState`. The pure resolver
 * {@link eventToTargetState} returns `null` for `resume_requested` only
 * because the resume target is not visible from the events module — that
 * is a layering detail, not a classification statement. Use
 * {@link eventCausesStateChange} together with the composite reducer to
 * answer the runtime question for a specific (event, currentState) pair.
 */
export function isAuditOnlyEvent(event: AutonomousRunEvent): boolean {
  switch (event.type) {
    case "decision_committed":
    case "user_override":
    case "provider_result":
    case "notification_sent":
      return true;
    default:
      return false;
  }
}

/* -------------------------------------------------------------------------- */
/*                              Per-type narrowing                            */
/* -------------------------------------------------------------------------- */

/**
 * Strict per-type schema lookup, since the union schema above uses
 * `z.union` to accommodate refinements. Use this when you've already
 * established the type discriminator and want the refined parser.
 */
export const EVENT_SCHEMAS_BY_TYPE = {
  state_change: StateChangeEventSchema,
  decision_committed: DecisionCommittedEventSchema,
  provider_result: ProviderResultEventSchema,
  user_override: UserOverrideEventSchema,
  timeout: TimeoutEventSchema,
  error: ErrorEventSchema,
  cancel_requested: CancelRequestedEventSchema,
  pause_requested: PauseRequestedEventSchema,
  resume_requested: ResumeRequestedEventSchema,
  notification_sent: NotificationSentEventSchema,
} as const satisfies Record<AutonomousRunEventType, z.ZodTypeAny>;
