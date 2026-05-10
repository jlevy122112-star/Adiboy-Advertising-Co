/**
 * Decision-point primitive.
 *
 * The product rule: **at every step where a value is set, the user must have
 * a say**. This module models that rule as data. A `DecisionPoint` describes
 * one such step (e.g. "pick a publish date", "choose a logo variant", "set
 * the alt-text for this image"). A `DecisionRecord` is the audit-log entry
 * the user (or the AI on the user's behalf) commits when the decision is
 * made.
 *
 * Two design tenets:
 *
 * 1. **AI never wins by default**. Every option carries a `source`, and
 *    `DecisionPoint.controlMode` declares whether the user must explicitly
 *    accept an AI suggestion before it sticks. Defaults bias toward
 *    "ai_suggest_user_confirm" for content-shape decisions and "user_only"
 *    for billing/legal decisions; admins can override per-workspace.
 *
 * 2. **Values are heterogeneous**. The same primitive must carry dates,
 *    colors, layouts, copy variants, image URLs, etc., so `value` is
 *    `unknown`. Stage-specific consumers narrow it with their own Zod
 *    schemas.
 *
 * See `customer-journey.ts` for how decision points compose into the full
 * intake → measure flow.
 */

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*                            Authority + provenance                          */
/* -------------------------------------------------------------------------- */

/**
 * The four canonical control modes. **Every feature in the app, from intake
 * to measure, presents exactly one of these.** This is a product invariant,
 * not a default — see `README.md` ("The Four Control Modes").
 *
 * - `user_only` — User must pick. The AI is not involved at this point.
 *   Used wherever it would be inappropriate for AI to choose for the user
 *   (billing, contact info, the user's own brand colors).
 * - `ai_with_optional_override` — AI auto-applies a value; user can change
 *   it at any time. Used when defaults need to be sensible without forcing
 *   a click (e.g. AI-set publish schedule with editable dates).
 * - `user_with_ai_assist` — User authors the value; AI offers suggestions
 *   on demand via a "give me ideas" affordance. Used for prose / drafting.
 * - `ai_suggest_user_confirm` — AI proposes options; user must accept,
 *   edit, or replace each one before it commits. Default for creative
 *   decisions (color palette, layout, alt-text, copy variants).
 *
 * "Compliance text", forced disclaimers, and other system invariants are
 * not decisions and therefore not modeled here — they bypass the decision
 * point system entirely.
 */
export const DecisionControlModeSchema = z.enum([
  "user_only",
  "ai_with_optional_override",
  "user_with_ai_assist",
  "ai_suggest_user_confirm",
]);
export type DecisionControlMode = z.infer<typeof DecisionControlModeSchema>;

/** All four control modes in canonical UI display order. */
export const DECISION_CONTROL_MODES: ReadonlyArray<DecisionControlMode> = [
  "user_only",
  "user_with_ai_assist",
  "ai_suggest_user_confirm",
  "ai_with_optional_override",
];

/** Provenance of a committed decision — populated by the writer, not the user. */
export const DecisionSourceSchema = z.enum([
  /** User typed / picked / drew it directly. */
  "user",
  /** AI-generated value committed without user changes. */
  "ai",
  /** AI-generated value the user modified before committing. */
  "ai_edited",
  /** Came from a saved user/workspace preset (brand theme, schedule preset). */
  "preset",
  /** Platform-supplied default (no user or AI involvement). */
  "system",
]);
export type DecisionSource = z.infer<typeof DecisionSourceSchema>;

/* -------------------------------------------------------------------------- */
/*                                  Options                                   */
/* -------------------------------------------------------------------------- */

/**
 * One option presented at a decision point. Multiple options can be shown
 * side-by-side so the user always sees alternatives, not a single "AI told
 * you so" answer.
 */
export const DecisionOptionSchema = z.object({
  /** Stable id within the parent decision point (kebab-case suggested). */
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(280),
  description: z.string().max(2000).optional(),
  /** The committed value if the user picks this option. */
  value: z.unknown(),
  /** Where this option came from. Mirrors `DecisionRecord.source`. */
  source: DecisionSourceSchema,
  /** Optional preview thumbnail (image URL or color hex are typical). */
  previewUrl: z.string().url().optional(),
  /** ISO 8601 timestamp the option was generated. */
  generatedAt: z.string().datetime().optional(),
  /** Optional 0–1 confidence score from the generator. */
  confidence: z.number().min(0).max(1).optional(),
  /** When `true`, this option came from a previous user decision and is being re-offered. */
  fromPreset: z.boolean().optional(),
});
export type DecisionOption = z.infer<typeof DecisionOptionSchema>;

/* -------------------------------------------------------------------------- */
/*                              Decision point                                */
/* -------------------------------------------------------------------------- */

/**
 * A point in the app where the user gets to decide. The full set of
 * decision points for a piece of content forms its editing surface — every
 * tunable setting is one of these.
 */
export const DecisionPointSchema = z.object({
  /** Stable kebab-case id (e.g. "schedule.authority", "design.color-source"). */
  id: z.string().min(1).max(120),
  /** Human label shown in the UI ("How should we set publish dates?"). */
  label: z.string().min(1).max(280),
  description: z.string().max(2000).optional(),
  /** Journey stage this point fires in (string to avoid circular dep). */
  stage: z.string().min(1).max(64),
  controlMode: DecisionControlModeSchema,
  /** When `true`, the journey blocks until this point has a record. */
  required: z.boolean(),
  /** When `true`, more than one option may be committed (e.g. multi-format export). */
  allowMultiSelect: z.boolean(),
  /** When `true`, the user can type a freeform value not in `options`. */
  allowCustomValue: z.boolean(),
  /** When `true`, the user can request a fresh round of AI suggestions. */
  allowRegenerate: z.boolean(),
  /** When `true`, the user can save their pick as a personal preset for reuse. */
  allowSaveAsPreset: z.boolean(),
  /** Options pre-loaded for the user. Empty list means "generate on demand". */
  options: z.array(DecisionOptionSchema),
  /** id of the option pre-highlighted as the system's suggestion (if any). */
  defaultOptionId: z.string().max(120).optional(),
});
export type DecisionPoint = z.infer<typeof DecisionPointSchema>;

/* -------------------------------------------------------------------------- */
/*                              Decision record                               */
/* -------------------------------------------------------------------------- */

/**
 * A single committed decision. Append-only; replacing a decision means
 * writing a new record that points back via `replacesRecordId`. The full
 * history is the user's edit log and powers the "undo back to here"
 * affordance the product wants on every screen.
 */
export const DecisionRecordSchema = z.object({
  recordId: z.string().min(1).max(120),
  decisionPointId: z.string().min(1).max(120),
  workspaceId: z.string().min(1).max(120),
  /** User responsible for the commit. Always set, even when source = "ai". */
  actorUserId: z.string().min(1).max(120),
  source: DecisionSourceSchema,
  /** ISO 8601 timestamp the user committed. */
  committedAt: z.string().datetime(),
  /** id of the picked option, or `null` when the value is custom-typed. */
  chosenOptionId: z.string().max(120).nullable(),
  /** Committed value (mirrors {@link DecisionOption.value}). */
  value: z.unknown(),
  note: z.string().max(2000).optional(),
  /** Set when this record supersedes an older one for the same point. */
  replacesRecordId: z.string().max(120).optional(),
});
export type DecisionRecord = z.infer<typeof DecisionRecordSchema>;

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

/**
 * Resolve the value the user has currently committed at a decision point.
 *
 * Latest record wins (by `committedAt`). When no record exists, falls back
 * to `defaultOptionId` if present, else returns `{ value: undefined,
 * source: "default" }`.
 */
export function resolveCommittedValue(
  point: DecisionPoint,
  records: ReadonlyArray<DecisionRecord>,
): {
  value: unknown;
  source: DecisionSource | "default";
  recordId?: string;
} {
  let head: DecisionRecord | undefined;
  for (const r of records) {
    if (r.decisionPointId !== point.id) continue;
    if (!head || r.committedAt > head.committedAt) {
      head = r;
    }
  }
  if (head) {
    return { value: head.value, source: head.source, recordId: head.recordId };
  }
  if (point.defaultOptionId) {
    const opt = point.options.find((o) => o.id === point.defaultOptionId);
    if (opt) {
      return { value: opt.value, source: "system" };
    }
  }
  return { value: undefined, source: "default" };
}

/** True when the point's `required` obligation has been met. */
export function isDecisionSatisfied(
  point: DecisionPoint,
  records: ReadonlyArray<DecisionRecord>,
): boolean {
  if (!point.required) return true;
  return records.some((r) => r.decisionPointId === point.id);
}

/**
 * Cross-validate a record against its parent point. Returns a tagged
 * result so callers can surface a specific error instead of a generic
 * "validation failed".
 */
export type DecisionValidationReason =
  | "decision_point_mismatch"
  | "unknown_option_id"
  | "custom_value_not_allowed"
  | "ai_source_disallowed_in_user_only_point";

export type DecisionValidationResult =
  | { ok: true }
  | { ok: false; reason: DecisionValidationReason };

export function validateDecisionRecord(
  point: DecisionPoint,
  record: DecisionRecord,
): DecisionValidationResult {
  if (record.decisionPointId !== point.id) {
    return { ok: false, reason: "decision_point_mismatch" };
  }
  if (record.chosenOptionId !== null) {
    const opt = point.options.find((o) => o.id === record.chosenOptionId);
    if (!opt) {
      return { ok: false, reason: "unknown_option_id" };
    }
  } else if (!point.allowCustomValue) {
    return { ok: false, reason: "custom_value_not_allowed" };
  }
  if (
    point.controlMode === "user_only" &&
    (record.source === "ai" || record.source === "ai_edited")
  ) {
    return { ok: false, reason: "ai_source_disallowed_in_user_only_point" };
  }
  return { ok: true };
}

/**
 * Build a fresh `DecisionRecord` for the given point + chosen option.
 * Convenience for callers — performs the validation and either returns the
 * record or the validation reason.
 */
export interface CommitDecisionArgs {
  readonly point: DecisionPoint;
  readonly recordId: string;
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly chosenOptionId: string | null;
  /** Required when `chosenOptionId === null` (custom value path). */
  readonly customValue?: unknown;
  readonly source: DecisionSource;
  readonly committedAt?: string;
  readonly note?: string;
  readonly replacesRecordId?: string;
}

export function commitDecision(
  args: CommitDecisionArgs,
):
  | { ok: true; record: DecisionRecord }
  | { ok: false; reason: DecisionValidationReason } {
  const {
    point,
    recordId,
    workspaceId,
    actorUserId,
    chosenOptionId,
    customValue,
    source,
    committedAt = new Date().toISOString(),
    note,
    replacesRecordId,
  } = args;

  let value: unknown;
  if (chosenOptionId === null) {
    value = customValue;
  } else {
    const opt = point.options.find((o) => o.id === chosenOptionId);
    value = opt?.value;
  }

  const record: DecisionRecord = {
    recordId,
    decisionPointId: point.id,
    workspaceId,
    actorUserId,
    source,
    committedAt,
    chosenOptionId,
    value,
    note,
    replacesRecordId,
  };

  const validation = validateDecisionRecord(point, record);
  if (!validation.ok) return { ok: false, reason: validation.reason };
  return { ok: true, record };
}
