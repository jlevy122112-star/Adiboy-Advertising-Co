/**
 * Decision audit log contract.
 *
 * Where `DecisionRecord` (see `decision-point.ts`) captures *what was
 * decided* at a single decision point, the **audit log entry** captures
 * the *context around* the decision:
 *
 *   - which entity the decision was about (workspace / campaign /
 *     schedule entry / brief / asset / autonomous run)
 *   - which alternatives were on the table at commit time
 *   - whether this entry supersedes an earlier one, and why
 *   - cross-system join keys (runId, briefId, scheduleEntryId) so the
 *     UI can render a unified timeline
 *
 * This module is the data contract only. Persistence (SQL, blob, etc.)
 * lives in `apps/api`. The audit log itself is **append-only** by
 * convention — new entries reference older ones via `supersedes.entryId`
 * rather than mutating them.
 *
 * Three product invariants encoded here:
 *
 * 1. **Append-only.** Helpers reject any attempt to "edit" a prior
 *    entry; the only way to change a committed decision is to append
 *    a new entry that supersedes it.
 *
 * 2. **Every committed change carries a reason.** When `kind` is
 *    `decision_superseded`, the `supersedes` field is required and
 *    carries a structured `reason`. The UI surfaces this in the
 *    timeline so users can see *why* a value flipped — never a bare
 *    "value changed" message.
 *
 * 3. **The user-only invariant is preserved across the log.** A
 *    `user_only` decision point never accepts an `ai` or `ai_edited`
 *    source, and helpers enforce this when validating new entries
 *    against the originating `DecisionPoint`.
 */

import { z } from "zod";

import { DecisionRecordSchema, DecisionSourceSchema } from "./decision-point.js";
import type { DecisionPoint, DecisionRecord } from "./decision-point.js";

/* -------------------------------------------------------------------------- */
/*                            Entry kind vocabulary                           */
/* -------------------------------------------------------------------------- */

/**
 * The six kinds of audit-log entries. Additive only; removing or
 * relabelling a kind is a breaking change.
 */
export const AUDIT_ENTRY_KINDS = [
  /** A `DecisionRecord` was written. The most common entry kind. */
  "decision_committed",
  /** An older `decision_committed` entry has been replaced. */
  "decision_superseded",
  /** AI proposed values; user has not committed yet. */
  "ai_suggestion_offered",
  /** User dismissed an AI suggestion without picking it. */
  "ai_suggestion_rejected",
  /** An autonomous run committed without surfacing the choice to the user. */
  "autonomous_override",
  /** User explicitly overrode an AI or autonomous decision. */
  "user_override",
] as const;

export type AuditEntryKind = (typeof AUDIT_ENTRY_KINDS)[number];
export const AuditEntryKindSchema = z.enum(AUDIT_ENTRY_KINDS);

/** Entry kinds that carry a `DecisionRecord`. */
const KINDS_WITH_RECORD: ReadonlySet<AuditEntryKind> = new Set([
  "decision_committed",
  "decision_superseded",
  "autonomous_override",
  "user_override",
]);

/** True when the entry kind requires a non-null `record` field. */
export function entryKindRequiresRecord(k: AuditEntryKind): boolean {
  return KINDS_WITH_RECORD.has(k);
}

/* -------------------------------------------------------------------------- */
/*                             Target taxonomy                                */
/* -------------------------------------------------------------------------- */

/**
 * What the decision was about. `kind` + `id` together identify the
 * subject of the audit entry. Adding a new target kind is additive.
 */
export const AUDIT_TARGET_KINDS = [
  "workspace",
  "campaign",
  "schedule_entry",
  "brief",
  "asset",
  "run",
] as const;

export type AuditTargetKind = (typeof AUDIT_TARGET_KINDS)[number];
export const AuditTargetKindSchema = z.enum(AUDIT_TARGET_KINDS);

export const AuditTargetSchema = z
  .object({
    kind: AuditTargetKindSchema,
    id: z.string().min(1).max(120),
    /**
     * Optional dotted path within the target, when the decision touches
     * a sub-field (e.g. `copy.headline` on a brief). Empty string means
     * "the whole entity".
     */
    path: z.string().max(280).default(""),
  })
  .strict();
export type AuditTarget = z.infer<typeof AuditTargetSchema>;

/* -------------------------------------------------------------------------- */
/*                            Supersede reasons                               */
/* -------------------------------------------------------------------------- */

/**
 * Why a `decision_superseded` entry was written. Surfaced to the user in
 * the timeline ("You re-edited this on May 4" vs "Autonomous run replaced
 * this on May 4 because the original failed validation").
 */
export const AUDIT_SUPERSEDE_REASONS = [
  /** User edited the value directly. */
  "user_edit",
  /** AI re-ran on the user's request and the new value was accepted. */
  "ai_regenerate",
  /** Autonomous run replaced the value (always paired with `kind="autonomous_override"`). */
  "autonomous_override",
  /** Downstream validation failed and the system substituted a safe default. */
  "validation_failure",
  /** A workspace-level policy change invalidated the prior value. */
  "policy_change",
  /** User rolled back to an earlier audit entry. */
  "rollback",
] as const;

export type AuditSupersedeReason = (typeof AUDIT_SUPERSEDE_REASONS)[number];
export const AuditSupersedeReasonSchema = z.enum(AUDIT_SUPERSEDE_REASONS);

/* -------------------------------------------------------------------------- */
/*                          Alternatives snapshot                             */
/* -------------------------------------------------------------------------- */

/**
 * A small record of one option that was on the table at commit time.
 * Stored on the audit entry so the timeline can answer "what would the
 * user have chosen instead?" without re-fetching the original options.
 */
export const AuditAlternativeSchema = z
  .object({
    optionId: z.string().min(1).max(120),
    source: DecisionSourceSchema,
    /** Optional 0–1 score from the generator at the moment it was offered. */
    confidence: z.number().min(0).max(1).optional(),
  })
  .strict();
export type AuditAlternative = z.infer<typeof AuditAlternativeSchema>;

/* -------------------------------------------------------------------------- */
/*                              Audit entry                                   */
/* -------------------------------------------------------------------------- */

/**
 * One row in the append-only audit log. Discriminated by `kind`.
 *
 * Cross-system join keys (`runId`, `briefId`, `scheduleEntryId`) are
 * optional but heavily encouraged — they're what makes the unified
 * timeline possible.
 */
export const DecisionAuditEntrySchema = z
  .object({
    entryId: z.string().min(1).max(120),
    workspaceId: z.string().min(1).max(120),
    kind: AuditEntryKindSchema,
    target: AuditTargetSchema,
    decisionPointId: z.string().min(1).max(120),
    /**
     * Present for kinds that committed a value
     * (decision_committed / decision_superseded / autonomous_override /
     * user_override). `null` for offer/reject entries.
     */
    record: DecisionRecordSchema.nullable(),
    /** Snapshot of alternatives at commit/offer time. Capped at 50. */
    alternativesOffered: z.array(AuditAlternativeSchema).max(50).default([]),
    /** Set when this entry supersedes an earlier one. */
    supersedes: z
      .object({
        entryId: z.string().min(1).max(120),
        reason: AuditSupersedeReasonSchema,
      })
      .strict()
      .nullable()
      .default(null),
    /** Cross-system join keys; null when not applicable. */
    runId: z.string().min(1).max(120).nullable().default(null),
    briefId: z.string().min(1).max(120).nullable().default(null),
    scheduleEntryId: z.string().min(1).max(120).nullable().default(null),
    /** ISO 8601 timestamp when the audit row was created. */
    createdAt: z.string().datetime(),
    /** Optional UI/compliance-facing explanation. */
    rationale: z.string().max(2000).default(""),
  })
  .strict()
  .refine(
    (e) => (entryKindRequiresRecord(e.kind) ? e.record !== null : e.record === null),
    {
      message:
        "record is required for decision_committed / decision_superseded / autonomous_override / user_override and forbidden otherwise",
      path: ["record"],
    },
  )
  .refine(
    (e) =>
      e.kind === "decision_superseded"
        ? e.supersedes !== null
        : e.kind === "user_override"
          ? // user_override implicitly supersedes the prior choice; supersedes may be present but is not required for the historical genesis case.
            true
          : e.supersedes === null,
    {
      message:
        "supersedes.entryId+reason required when kind is 'decision_superseded'; forbidden for non-supersede kinds (except 'user_override' which may carry it).",
      path: ["supersedes"],
    },
  )
  .refine(
    (e) =>
      e.kind === "autonomous_override"
        ? e.runId !== null && e.record !== null && e.record.source !== "user"
        : true,
    {
      message:
        "autonomous_override entries require runId and a non-'user' source on the underlying record",
      path: ["kind"],
    },
  );
export type DecisionAuditEntry = z.infer<typeof DecisionAuditEntrySchema>;

/* -------------------------------------------------------------------------- */
/*                                Log type                                    */
/* -------------------------------------------------------------------------- */

/** A read-only handle on the in-memory audit log. */
export type DecisionAuditLog = ReadonlyArray<DecisionAuditEntry>;

/* -------------------------------------------------------------------------- */
/*                              Factory                                       */
/* -------------------------------------------------------------------------- */

/**
 * Build an entry from minimal arguments. Defaults `alternativesOffered`,
 * `supersedes`, `runId`, `briefId`, `scheduleEntryId`, and `rationale`
 * to their schema defaults.
 *
 * Throws when the resulting entry fails schema validation, so callers
 * always get a fully-typed `DecisionAuditEntry` or an error — never a
 * half-baked record.
 */
export interface CreateAuditEntryArgs {
  readonly entryId: string;
  readonly workspaceId: string;
  readonly kind: AuditEntryKind;
  readonly target: AuditTarget;
  readonly decisionPointId: string;
  readonly record?: DecisionRecord | null;
  readonly alternativesOffered?: ReadonlyArray<AuditAlternative>;
  readonly supersedes?: {
    readonly entryId: string;
    readonly reason: AuditSupersedeReason;
  } | null;
  readonly runId?: string | null;
  readonly briefId?: string | null;
  readonly scheduleEntryId?: string | null;
  readonly createdAt: string;
  readonly rationale?: string;
}

export function createAuditEntry(
  args: CreateAuditEntryArgs,
): DecisionAuditEntry {
  return DecisionAuditEntrySchema.parse({
    entryId: args.entryId,
    workspaceId: args.workspaceId,
    kind: args.kind,
    target: args.target,
    decisionPointId: args.decisionPointId,
    record: args.record ?? null,
    alternativesOffered: args.alternativesOffered ?? [],
    supersedes: args.supersedes ?? null,
    runId: args.runId ?? null,
    briefId: args.briefId ?? null,
    scheduleEntryId: args.scheduleEntryId ?? null,
    createdAt: args.createdAt,
    rationale: args.rationale ?? "",
  });
}

/* -------------------------------------------------------------------------- */
/*                              Append helper                                 */
/* -------------------------------------------------------------------------- */

export type AppendRejectionReason =
  | "duplicate_entry_id"
  | "createdAt_not_monotonic"
  | "supersedes_unknown_entry"
  | "workspace_mismatch";

export type AppendResult =
  | { ok: true; log: DecisionAuditLog }
  | { ok: false; reason: AppendRejectionReason };

/**
 * Append an entry to the log. Enforces three append-only invariants:
 *
 *   1. `entryId` is unique across the log.
 *   2. `createdAt` is greater than or equal to the last entry's
 *      `createdAt` (monotonic time).
 *   3. If `supersedes.entryId` is set, that entry exists in the log.
 *   4. `workspaceId` matches the rest of the log (mixed-workspace logs
 *      are forbidden — keep one log per workspace).
 *
 * Returns a tagged result so callers can react to specific failures.
 */
export function appendAuditEntry(
  log: DecisionAuditLog,
  entry: DecisionAuditEntry,
): AppendResult {
  if (log.length > 0) {
    const head = log[log.length - 1]!;
    if (head.workspaceId !== entry.workspaceId) {
      return { ok: false, reason: "workspace_mismatch" };
    }
    if (entry.createdAt < head.createdAt) {
      return { ok: false, reason: "createdAt_not_monotonic" };
    }
  }
  for (const e of log) {
    if (e.entryId === entry.entryId) {
      return { ok: false, reason: "duplicate_entry_id" };
    }
  }
  if (entry.supersedes !== null) {
    const targetId = entry.supersedes.entryId;
    const found = log.some((e) => e.entryId === targetId);
    if (!found) {
      return { ok: false, reason: "supersedes_unknown_entry" };
    }
  }
  return { ok: true, log: [...log, entry] };
}

/* -------------------------------------------------------------------------- */
/*                       Validation against the source point                  */
/* -------------------------------------------------------------------------- */

export type AuditValidationReason =
  | "decision_point_mismatch"
  | "ai_source_disallowed_in_user_only_point";

export type AuditValidationResult =
  | { ok: true }
  | { ok: false; reason: AuditValidationReason };

/**
 * Cross-validate an entry against its originating `DecisionPoint`. The
 * key invariant: if the point is `user_only`, the entry's underlying
 * record cannot have an AI source.
 */
export function validateAuditEntryAgainstPoint(
  point: DecisionPoint,
  entry: DecisionAuditEntry,
): AuditValidationResult {
  if (entry.decisionPointId !== point.id) {
    return { ok: false, reason: "decision_point_mismatch" };
  }
  if (
    point.controlMode === "user_only" &&
    entry.record &&
    (entry.record.source === "ai" || entry.record.source === "ai_edited")
  ) {
    return { ok: false, reason: "ai_source_disallowed_in_user_only_point" };
  }
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*                              Projections                                   */
/* -------------------------------------------------------------------------- */

/**
 * The current head decision for a `(target, decisionPointId)` tuple:
 * the most recent entry of a record-bearing kind that has NOT been
 * superseded by a later entry. Returns `null` when no committed
 * decision exists yet for that tuple.
 */
export function findCurrentDecision(
  log: DecisionAuditLog,
  target: Pick<AuditTarget, "kind" | "id">,
  decisionPointId: string,
): DecisionAuditEntry | null {
  const supersededIds = new Set<string>();
  for (const e of log) {
    if (e.supersedes !== null) {
      supersededIds.add(e.supersedes.entryId);
    }
  }
  let head: DecisionAuditEntry | null = null;
  for (const e of log) {
    if (e.target.kind !== target.kind || e.target.id !== target.id) continue;
    if (e.decisionPointId !== decisionPointId) continue;
    if (!entryKindRequiresRecord(e.kind)) continue;
    if (supersededIds.has(e.entryId)) continue;
    if (!head || e.createdAt > head.createdAt) {
      head = e;
    }
  }
  return head;
}

/**
 * Every entry for one `(target, decisionPointId)`, in commit order.
 * Includes superseded entries — this is the full timeline the UI shows.
 */
export function decisionTrailFor(
  log: DecisionAuditLog,
  target: Pick<AuditTarget, "kind" | "id">,
  decisionPointId: string,
): ReadonlyArray<DecisionAuditEntry> {
  return log.filter(
    (e) =>
      e.target.kind === target.kind &&
      e.target.id === target.id &&
      e.decisionPointId === decisionPointId,
  );
}

/** Every entry tied to a specific autonomous run (forensics). */
export function auditEntriesForRun(
  log: DecisionAuditLog,
  runId: string,
): ReadonlyArray<DecisionAuditEntry> {
  return log.filter((e) => e.runId === runId);
}

/** Every entry tied to a specific generation brief (forensics). */
export function auditEntriesForBrief(
  log: DecisionAuditLog,
  briefId: string,
): ReadonlyArray<DecisionAuditEntry> {
  return log.filter((e) => e.briefId === briefId);
}

/** Every entry tied to a specific schedule entry (forensics). */
export function auditEntriesForScheduleEntry(
  log: DecisionAuditLog,
  scheduleEntryId: string,
): ReadonlyArray<DecisionAuditEntry> {
  return log.filter((e) => e.scheduleEntryId === scheduleEntryId);
}

/* -------------------------------------------------------------------------- */
/*                              Predicates                                    */
/* -------------------------------------------------------------------------- */

/**
 * True when the trail for this `(target, point)` contains at least one
 * `user_override` entry. Used to surface "you've already adjusted this"
 * affordances in the UI.
 */
export function wasOverriddenByUser(
  log: DecisionAuditLog,
  target: Pick<AuditTarget, "kind" | "id">,
  decisionPointId: string,
): boolean {
  return decisionTrailFor(log, target, decisionPointId).some(
    (e) => e.kind === "user_override",
  );
}

/**
 * True when the current head decision was committed by an autonomous
 * run rather than the user. Used by the UI to badge AI-authored values.
 */
export function isHeadDecisionAutonomous(
  log: DecisionAuditLog,
  target: Pick<AuditTarget, "kind" | "id">,
  decisionPointId: string,
): boolean {
  const head = findCurrentDecision(log, target, decisionPointId);
  return head !== null && head.kind === "autonomous_override";
}

/**
 * The reason an entry was superseded, or `null` if it wasn't.
 */
export function supersedeReasonOf(
  entry: DecisionAuditEntry,
): AuditSupersedeReason | null {
  return entry.supersedes?.reason ?? null;
}

/* -------------------------------------------------------------------------- */
/*                              Read helpers                                  */
/* -------------------------------------------------------------------------- */

/** All canonical audit-entry kinds (for UI dropdowns, validation, etc.). */
export function listAuditEntryKinds(): ReadonlyArray<AuditEntryKind> {
  return AUDIT_ENTRY_KINDS;
}

/** All canonical target kinds. */
export function listAuditTargetKinds(): ReadonlyArray<AuditTargetKind> {
  return AUDIT_TARGET_KINDS;
}

/** All canonical supersede reasons. */
export function listAuditSupersedeReasons(): ReadonlyArray<AuditSupersedeReason> {
  return AUDIT_SUPERSEDE_REASONS;
}
