/**
 * Generation Brief — the structured task specification consumed by the
 * asset generator.
 *
 * A {@link GenerationBrief} is the single "work order" handed to the
 * generator (be it AI, a templating engine, or a human operator) to
 * produce ONE concrete asset for ONE platform/format. It packages
 * everything the generator needs:
 *
 *   - identity: workspace + (optional) autonomous run + format + network
 *   - directives: copy, design, voice, SEO, image-optimisation, theme override
 *   - provenance: which AI/user/source authored each field (for audit)
 *   - lifecycle: status (draft → validated → generating → terminal)
 *
 * The brief is the bridge between "user clicks Generate" and "an asset
 * gets produced". It enforces a consistent contract so the generator,
 * validators, queueing layer, and audit log all agree on the shape of
 * a piece of work.
 *
 * Status lifecycle:
 *
 *     draft ──▶ validated ──▶ generating ──┬─▶ generated ─▶ obsolete
 *       ▲          │              │        ├─▶ failed    ─▶ obsolete
 *       └──────────┘              └────────┴─▶ obsolete (cancel in-flight)
 *
 * `obsolete` is the only terminal-of-terminals; from it nothing flows.
 */

import { z } from "zod";

import { BrandThemeOverrideSchema } from "./brand-theme.js";
import { findAssetFormatById } from "./content-asset-formats.js";
import { DecisionSourceSchema } from "./decision-point.js";
import { ImageOptimizationOverrideSchema } from "./image-optimization.js";
import { SeoMetadataOverrideSchema } from "./seo-metadata.js";
import {
  PUBLISHABLE_NETWORKS,
  PublishableNetworkSchema,
} from "./social-connections.js";

/* -------------------------------------------------------------------------- */
/*                              Constant rosters                              */
/* -------------------------------------------------------------------------- */

export const BRIEF_STATUSES = [
  "draft",
  "validated",
  "generating",
  "generated",
  "failed",
  "obsolete",
] as const;
export type BriefStatus = (typeof BRIEF_STATUSES)[number];
export const BriefStatusSchema = z.enum(BRIEF_STATUSES);

export const BRIEF_SOURCES = [
  "manual_user",
  "ai_proposed",
  "ai_committed",
  "autonomous_run",
] as const;
export type BriefSource = (typeof BRIEF_SOURCES)[number];
export const BriefSourceSchema = z.enum(BRIEF_SOURCES);

export const BRIEF_FAILURE_KINDS = [
  "validation_failed",
  "policy_blocked",
  "brand_theme_lint_blocked",
  "provider_error",
  "timeout",
  "internal_error",
  "cancelled",
] as const;
export type BriefFailureKind = (typeof BRIEF_FAILURE_KINDS)[number];
export const BriefFailureKindSchema = z.enum(BRIEF_FAILURE_KINDS);

export const PALETTE_MODES = [
  "brand_primary",
  "brand_secondary",
  "format_default",
  "custom_hex",
  "monochrome",
] as const;
export type PaletteMode = (typeof PALETTE_MODES)[number];
export const PaletteModeSchema = z.enum(PALETTE_MODES);

export const IMAGERY_DIRECTIONS = [
  "none",
  "user_uploaded",
  "stock_photo",
  "ai_generated",
  "brand_library",
] as const;
export type ImageryDirection = (typeof IMAGERY_DIRECTIONS)[number];
export const ImageryDirectionSchema = z.enum(IMAGERY_DIRECTIONS);

export const LAYOUT_INTENTS = [
  "centered",
  "left_aligned",
  "right_aligned",
  "split",
  "full_bleed",
  "free_form",
] as const;
export type LayoutIntent = (typeof LAYOUT_INTENTS)[number];
export const LayoutIntentSchema = z.enum(LAYOUT_INTENTS);

export const VOICE_TONE_SHIFTS = [
  "match_brand",
  "more_urgent",
  "more_friendly",
  "more_professional",
  "more_playful",
  "more_authoritative",
] as const;
export type VoiceToneShift = (typeof VOICE_TONE_SHIFTS)[number];
export const VoiceToneShiftSchema = z.enum(VOICE_TONE_SHIFTS);

/**
 * Phase 2 — campaign / asset objective codes (persisted on briefs).
 * Matches Meta (Facebook / Instagram) Ads Manager **Outcome** objectives (six goals);
 * snake_case codes are our stable JSON/API surface (`app_promotion` ↔ Meta “App promotion”).
 */
export const CONTENT_GOALS = [
  "awareness",
  "traffic",
  "engagement",
  "leads",
  "app_promotion",
  "sales",
] as const;
export type ContentGoal = (typeof CONTENT_GOALS)[number];
export const ContentGoalSchema = z.enum(CONTENT_GOALS);

/** Human-readable names for settings UI — mirror Meta Ads Manager English labels (codes stay stable). */
export const CONTENT_GOAL_LABELS: Record<ContentGoal, string> = {
  awareness: "Awareness",
  traffic: "Traffic",
  engagement: "Engagement",
  leads: "Leads",
  app_promotion: "App promotion",
  sales: "Sales",
};

export function labelContentGoal(goal: ContentGoal): string {
  return CONTENT_GOAL_LABELS[goal];
}

/**
 * Deterministic angle bullets for the stub draft body until the real generator
 * reads goals from workspace strategy. Keeps copy suggestions stable in tests.
 */
export function stubContentGoalGuidance(goal: ContentGoal): readonly string[] {
  switch (goal) {
    case "awareness":
      return [
        "Optimize for recall and brand story; curiosity beats hard promotion in the hook.",
        "Keep the CTA soft (learn more / follow) unless the brief already specifies otherwise.",
      ];
    case "traffic":
      return [
        "Lead with a clear reason to click through; promise matches the landing experience.",
        "Use specificity (who / what / when) over vague hype to earn the visit.",
      ];
    case "engagement":
      return [
        "Invite interaction: question, poll, save-worthy tip, or strong POV — avoid passive filler.",
        "Front-load the emotional or informational payoff so the first line earns the stop scroll.",
      ];
    case "leads":
      return [
        "State the value exchange for contact info early; one primary conversion action.",
        "Build trust fast: proof point, qualifier, or risk reversal aligned to the offer.",
      ];
    case "app_promotion":
      return [
        "Optimize for the promoted destination Meta can attribute (app install, catalog, or shop) — align the CTA with what the brief actually offers.",
        "Avoid inventing store ratings, prices, or permissions; stick to claims the brief already supports.",
      ];
    case "sales":
      return [
        "Lead with offer clarity (what, for whom, by when); one decisive purchase CTA.",
        "Reduce friction: price clarity, guarantee, or urgency only when the brief supplies facts.",
      ];
  }
}

/* -------------------------------------------------------------------------- */
/*                              Sub-schemas                                   */
/* -------------------------------------------------------------------------- */

/** 3- or 6-digit hex colour with leading `#`. */
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

/** Matches `headline` / `subhead` `.max()` on {@link CopyDirectivesSchema}. */
export const COPY_DIRECTIVES_HEADLINE_SUBHEAD_MAX_CHARS = 280 as const;

/** Copy / text directives that the generator should honour. */
export const CopyDirectivesSchema = z
  .object({
    headline: z
      .string()
      .max(COPY_DIRECTIVES_HEADLINE_SUBHEAD_MAX_CHARS)
      .optional(),
    subhead: z
      .string()
      .max(COPY_DIRECTIVES_HEADLINE_SUBHEAD_MAX_CHARS)
      .optional(),
    body: z.string().max(10_000).optional(),
    cta: z.string().max(80).optional(),
    hashtags: z.array(z.string().max(60)).max(40).optional(),
    /** Must be `https://...` or empty. Empty is allowed so callers can
     *  "intentionally clear" a previously-set link. */
    link: z
      .string()
      .max(2_000)
      .refine((s) => s === "" || /^https:\/\//.test(s), {
        message: "link must be an https:// URL or an empty string",
      })
      .optional(),
    /** Hard cap on body length. Used by validators to detect long-form formats. */
    maxBodyChars: z.number().int().min(0).max(100_000).optional(),
  })
  .strict();
export type CopyDirectives = z.infer<typeof CopyDirectivesSchema>;

/** Visual / design directives. */
export const DesignDirectivesSchema = z
  .object({
    paletteMode: PaletteModeSchema,
    customPaletteHex: z.array(z.string().regex(HEX_COLOR)).max(8).optional(),
    imageryDirection: ImageryDirectionSchema,
    imageryQuery: z.string().max(280).optional(),
    imageryAssetId: z.string().max(120).optional(),
    layoutIntent: LayoutIntentSchema,
    mood: z.string().max(120).optional(),
    notes: z.string().max(500).optional(),
  })
  .strict()
  .refine(
    (d) =>
      d.paletteMode !== "custom_hex" || (d.customPaletteHex?.length ?? 0) > 0,
    {
      message: "customPaletteHex required when paletteMode is 'custom_hex'",
      path: ["customPaletteHex"],
    },
  )
  .refine(
    (d) =>
      !["stock_photo", "ai_generated"].includes(d.imageryDirection) ||
      (typeof d.imageryQuery === "string" && d.imageryQuery.trim().length > 0),
    {
      message:
        "imageryQuery required when imageryDirection is 'stock_photo' or 'ai_generated'",
      path: ["imageryQuery"],
    },
  )
  .refine(
    (d) =>
      d.imageryDirection !== "user_uploaded" ||
      (typeof d.imageryAssetId === "string" && d.imageryAssetId.length > 0),
    {
      message: "imageryAssetId required when imageryDirection is 'user_uploaded'",
      path: ["imageryAssetId"],
    },
  );
export type DesignDirectives = z.infer<typeof DesignDirectivesSchema>;

/** Voice / tone overrides relative to the workspace voice profile. */
export const VoiceDirectivesSchema = z
  .object({
    toneShift: VoiceToneShiftSchema.optional(),
    formalityOverride: z.number().int().min(1).max(5).optional(),
    bannedWordsAdditional: z.array(z.string().max(80)).max(40).optional(),
    preferredPhrasesAdditional: z.array(z.string().max(120)).max(20).optional(),
    note: z.string().max(500).optional(),
  })
  .strict();
export type VoiceDirectives = z.infer<typeof VoiceDirectivesSchema>;

/**
 * Per-field provenance map: dotted-path → which `DecisionSource` authored
 * the value at that path. Used by the audit log and the UI to surface
 * "this was AI-generated" vs "user-typed" hints.
 */
export const BriefFieldSourcesSchema = z
  .record(z.string().max(120), DecisionSourceSchema)
  .refine((rec) => Object.keys(rec).length <= 200, {
    message: "fieldSources may have at most 200 entries",
  });
export type BriefFieldSources = z.infer<typeof BriefFieldSourcesSchema>;

/* -------------------------------------------------------------------------- */
/*                              GenerationBrief                                */
/* -------------------------------------------------------------------------- */

/**
 * Statuses with NO further legal transitions out. Only `obsolete` is
 * truly terminal — `generated` and `failed` can both still transition
 * to `obsolete` (e.g. a regenerate or supersede flow).
 */
const TERMINAL_STATUSES: ReadonlySet<BriefStatus> = new Set(["obsolete"]);

/**
 * Statuses that finalise a brief's lifecycle (`finalisedAt` is set,
 * either as a success outcome, a failure outcome, or a deliberate
 * abandonment). Distinct from "terminal" — a finalised brief may
 * still have one onward transition (`generated`/`failed` → `obsolete`).
 */
const FINALISED_STATUSES: ReadonlySet<BriefStatus> = new Set([
  "generated",
  "failed",
  "obsolete",
]);

/** True if no further legal transitions exist *out of* this status. */
export function isTerminalBriefStatus(s: BriefStatus): boolean {
  return TERMINAL_STATUSES.has(s);
}

/** True if this status finalises the brief (sets `finalisedAt`). */
function isFinalisedStatus(s: BriefStatus): boolean {
  return FINALISED_STATUSES.has(s);
}

/**
 * The canonical generation brief schema. Every field is explicit; unknown
 * top-level keys are rejected (`.strict()`). Cross-field invariants are
 * enforced via four refinements:
 *
 *   1. `failureKind` is required when `status === "failed"`.
 *   2. `resultId`    is required when `status === "generated"`.
 *   3. `finalisedAt` is required for terminal statuses, forbidden otherwise.
 *   4. `runId`       is required when `source === "autonomous_run"`.
 */
export const GenerationBriefSchema = z
  .object({
    briefId: z.string().min(1).max(120),
    workspaceId: z.string().min(1).max(120),
    runId: z.string().min(1).max(120).nullable(),
    scheduleEntryId: z.string().min(1).max(120).nullable(),
    parentBriefId: z.string().min(1).max(120).nullable(),
    formatId: z.string().min(1).max(120),
    network: PublishableNetworkSchema,
    contentGoal: ContentGoalSchema.optional(),
    copy: CopyDirectivesSchema,
    design: DesignDirectivesSchema.optional(),
    voice: VoiceDirectivesSchema.optional(),
    seo: SeoMetadataOverrideSchema.optional(),
    imageOpt: ImageOptimizationOverrideSchema.optional(),
    themeOverride: BrandThemeOverrideSchema.optional(),
    source: BriefSourceSchema,
    fieldSources: BriefFieldSourcesSchema.default({}),
    status: BriefStatusSchema,
    failureKind: BriefFailureKindSchema.nullable(),
    failureMessage: z.string().max(2_000).nullable(),
    resultId: z.string().min(1).max(120).nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    finalisedAt: z.string().datetime().nullable(),
  })
  .strict()
  .refine((b) => b.status !== "failed" || b.failureKind !== null, {
    message: "failureKind required when status is 'failed'",
    path: ["failureKind"],
  })
  .refine((b) => b.status !== "generated" || b.resultId !== null, {
    message: "resultId required when status is 'generated'",
    path: ["resultId"],
  })
  .refine(
    (b) => {
      const fin = isFinalisedStatus(b.status);
      return fin ? b.finalisedAt !== null : b.finalisedAt === null;
    },
    {
      message:
        "finalisedAt required for finalised statuses ('generated' | 'failed' | 'obsolete') and forbidden otherwise",
      path: ["finalisedAt"],
    },
  )
  .refine((b) => b.source !== "autonomous_run" || b.runId !== null, {
    message: "runId required when source is 'autonomous_run'",
    path: ["runId"],
  });
export type GenerationBrief = z.infer<typeof GenerationBriefSchema>;

/* -------------------------------------------------------------------------- */
/*                              Status transitions                            */
/* -------------------------------------------------------------------------- */

/**
 * Legal status transitions. Note that `generating → obsolete` is allowed
 * so users can cancel an in-flight generation; the eventual provider
 * response will be discarded by the orchestrator.
 */
const LEGAL_TRANSITIONS: Record<BriefStatus, readonly BriefStatus[]> = {
  draft: ["validated", "obsolete"],
  validated: ["draft", "generating", "obsolete"],
  generating: ["generated", "failed", "obsolete"],
  generated: ["obsolete"],
  failed: ["obsolete"],
  obsolete: [],
};

export type BriefTransitionRejectionReason =
  | "same_status"
  | "from_status_terminal"
  | "to_status_not_legal_from_origin";

export type BriefTransitionResult =
  | { ok: true }
  | { ok: false; reason: BriefTransitionRejectionReason };

/** Pure transition validator. Order of checks: terminal → same → legal. */
export function validateBriefTransition(
  from: BriefStatus,
  to: BriefStatus,
): BriefTransitionResult {
  if (isTerminalBriefStatus(from)) {
    return { ok: false, reason: "from_status_terminal" };
  }
  if (from === to) {
    return { ok: false, reason: "same_status" };
  }
  if (!LEGAL_TRANSITIONS[from].includes(to)) {
    return { ok: false, reason: "to_status_not_legal_from_origin" };
  }
  return { ok: true };
}

/** Returns the canonical status roster (re-export of `BRIEF_STATUSES`). */
export function listAllBriefStatuses(): readonly BriefStatus[] {
  return BRIEF_STATUSES;
}

/* -------------------------------------------------------------------------- */
/*                              Factory: createBrief                          */
/* -------------------------------------------------------------------------- */

export interface CreateBriefArgs {
  readonly briefId: string;
  readonly workspaceId: string;
  readonly formatId: string;
  readonly network: z.infer<typeof PublishableNetworkSchema>;
  readonly contentGoal?: ContentGoal;
  readonly source: BriefSource;
  readonly copy: CopyDirectives;
  readonly design?: DesignDirectives;
  readonly voice?: VoiceDirectives;
  readonly runId?: string | null;
  readonly scheduleEntryId?: string | null;
  readonly parentBriefId?: string | null;
  readonly fieldSources?: BriefFieldSources;
  readonly now?: () => string;
}

/**
 * Constructs a new draft brief. Throws if the resulting object would
 * fail schema validation (e.g. autonomous_run source without runId).
 */
export function createBrief(args: CreateBriefArgs): GenerationBrief {
  const now = args.now ? args.now() : new Date().toISOString();
  const candidate = {
    briefId: args.briefId,
    workspaceId: args.workspaceId,
    runId: args.runId ?? null,
    scheduleEntryId: args.scheduleEntryId ?? null,
    parentBriefId: args.parentBriefId ?? null,
    formatId: args.formatId,
    network: args.network,
    contentGoal: args.contentGoal,
    copy: args.copy,
    design: args.design,
    voice: args.voice,
    seo: undefined,
    imageOpt: undefined,
    themeOverride: undefined,
    source: args.source,
    fieldSources: args.fieldSources ?? {},
    status: "draft" as const,
    failureKind: null,
    failureMessage: null,
    resultId: null,
    createdAt: now,
    updatedAt: now,
    finalisedAt: null,
  };
  return GenerationBriefSchema.parse(candidate);
}

/* -------------------------------------------------------------------------- */
/*                              validateBriefForGeneration                    */
/* -------------------------------------------------------------------------- */

export type BriefIssueCode =
  | "missing_copy_headline"
  | "missing_copy_body_for_long_form"
  | "missing_design"
  | "missing_imagery_query"
  | "missing_custom_palette"
  | "format_unknown"
  | "format_network_mismatch";

export interface BriefIssue {
  readonly code: BriefIssueCode;
  readonly message: string;
  readonly path: readonly string[];
}

export type BriefValidationResult =
  | { ok: true }
  | { ok: false; issues: BriefIssue[] };

export interface ValidateBriefForGenerationOptions {
  /** Body required when `copy.maxBodyChars >= longFormBodyThreshold` (default 280). */
  readonly longFormBodyThreshold?: number;
}

/**
 * Stricter-than-schema validation — answers "is this brief complete
 * enough for the generator to act on?". A brief can be schema-valid
 * (parses through `GenerationBriefSchema`) yet still be missing fields
 * the generator needs (e.g. `copy.headline === ""`, `design === undefined`,
 * format catalog mismatch).
 *
 * Returns `{ ok: true }` or `{ ok: false, issues: [...] }`. Each issue
 * carries a stable `code` so the UI can map it to a fix-it action.
 */
export function validateBriefForGeneration(
  brief: GenerationBrief,
  options: ValidateBriefForGenerationOptions = {},
): BriefValidationResult {
  const issues: BriefIssue[] = [];
  const longFormBodyThreshold = options.longFormBodyThreshold ?? 280;

  // Headline (always required).
  if (!brief.copy.headline || brief.copy.headline.trim() === "") {
    issues.push({
      code: "missing_copy_headline",
      message: "copy.headline is required for generation",
      path: ["copy", "headline"],
    });
  }

  // Body required only when the caller has explicitly declared a long-form
  // budget at-or-above the threshold. Default `0` (instead of `?? threshold`)
  // means "no body required unless caller opts in".
  const declaredMax = brief.copy.maxBodyChars ?? 0;
  if (
    declaredMax >= longFormBodyThreshold &&
    (!brief.copy.body || brief.copy.body.trim() === "")
  ) {
    issues.push({
      code: "missing_copy_body_for_long_form",
      message: `copy.body is required for long-form formats (>= ${longFormBodyThreshold} chars)`,
      path: ["copy", "body"],
    });
  }

  // Design directives.
  if (!brief.design) {
    issues.push({
      code: "missing_design",
      message: "design directives are required for generation",
      path: ["design"],
    });
  } else {
    if (
      ["stock_photo", "ai_generated"].includes(brief.design.imageryDirection) &&
      (!brief.design.imageryQuery ||
        brief.design.imageryQuery.trim() === "")
    ) {
      issues.push({
        code: "missing_imagery_query",
        message:
          "imageryQuery required when imageryDirection is 'stock_photo' or 'ai_generated'",
        path: ["design", "imageryQuery"],
      });
    }
    if (
      brief.design.paletteMode === "custom_hex" &&
      (!brief.design.customPaletteHex ||
        brief.design.customPaletteHex.length === 0)
    ) {
      issues.push({
        code: "missing_custom_palette",
        message:
          "customPaletteHex required when paletteMode is 'custom_hex'",
        path: ["design", "customPaletteHex"],
      });
    }
  }

  // Format catalog + network: only publishable formats constrain brief.network.
  const format = findAssetFormatById(brief.formatId);
  if (!format) {
    issues.push({
      code: "format_unknown",
      message: `formatId '${brief.formatId}' is not in the catalog`,
      path: ["formatId"],
    });
  } else {
    const formatNetwork = format.network as string;
    if (
      (PUBLISHABLE_NETWORKS as readonly string[]).includes(formatNetwork) &&
      formatNetwork !== brief.network
    ) {
      issues.push({
        code: "format_network_mismatch",
        message: `format.network='${formatNetwork}' does not match brief.network='${brief.network}'`,
        path: ["network"],
      });
    }
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/* -------------------------------------------------------------------------- */
/*                              transitionBriefStatus                         */
/* -------------------------------------------------------------------------- */

export interface TransitionBriefStatusArgs {
  readonly to: BriefStatus;
  readonly now: () => string;
  readonly failure?: {
    readonly kind: BriefFailureKind;
    readonly message: string;
  };
  readonly resultId?: string;
}

export type TransitionBriefStatusResult =
  | { ok: true; brief: GenerationBrief }
  | {
      ok: false;
      brief: GenerationBrief;
      reason: BriefTransitionRejectionReason;
    };

/**
 * Pure status transition. Returns a NEW brief on success (input is not
 * mutated). On rejection, returns `{ ok: false }` with the original brief
 * and a structured reason — never throws for invalid transitions.
 *
 * Throws (caller bug) only when required-companion-args are missing:
 *   - `to: "failed"`     requires `failure` arg
 *   - `to: "generated"`  requires `resultId` arg
 */
export function transitionBriefStatus(
  brief: GenerationBrief,
  args: TransitionBriefStatusArgs,
): TransitionBriefStatusResult {
  const validation = validateBriefTransition(brief.status, args.to);
  if (!validation.ok) {
    return { ok: false, brief, reason: validation.reason };
  }

  if (args.to === "failed" && !args.failure) {
    throw new Error(
      "transitionBriefStatus: 'failure' arg required when transitioning to 'failed'",
    );
  }
  if (args.to === "generated" && !args.resultId) {
    throw new Error(
      "transitionBriefStatus: 'resultId' arg required when transitioning to 'generated'",
    );
  }

  const now = args.now();
  const fin = isFinalisedStatus(args.to);

  const next: GenerationBrief = {
    ...brief,
    status: args.to,
    updatedAt: now,
    finalisedAt: fin ? now : brief.finalisedAt,
    failureKind:
      args.to === "failed" && args.failure
        ? args.failure.kind
        : brief.failureKind,
    failureMessage:
      args.to === "failed" && args.failure
        ? args.failure.message
        : brief.failureMessage,
    resultId:
      args.to === "generated" && args.resultId
        ? args.resultId
        : brief.resultId,
  };

  // Schema-parse on exit so callers always get a validated record.
  return { ok: true, brief: GenerationBriefSchema.parse(next) };
}

/* -------------------------------------------------------------------------- */
/*                              Field source provenance                       */
/* -------------------------------------------------------------------------- */

/**
 * Records the source (user / ai / ai_edited / ...) of a single field on
 * the brief. Returns a NEW brief; does not mutate the input. Overwrites
 * any prior entry at the same path.
 */
export function recordFieldSource(
  brief: GenerationBrief,
  path: string,
  source: z.infer<typeof DecisionSourceSchema>,
  now: () => string,
): GenerationBrief {
  return {
    ...brief,
    fieldSources: { ...brief.fieldSources, [path]: source },
    updatedAt: now(),
  };
}

/* -------------------------------------------------------------------------- */
/*                              Deterministic ID                              */
/* -------------------------------------------------------------------------- */

function hash8(input: string): string {
  // Browser + Node compatible: simple deterministic hash (djb2)
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h) ^ input.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Deterministic brief id: same inputs always produce the same id.
 * Powers idempotency in the autonomous orchestrator — re-enqueueing
 * the same (run, schedule entry, format) tuple is a no-op.
 *
 * Format: `brief_HHHHHHHH_HHHHHHHH_HHHHHHHH` (3× 8-char SHA-1 prefix).
 */
export function briefIdFor(args: {
  readonly runId: string;
  readonly scheduleEntryId: string;
  readonly formatId: string;
}): string {
  return [
    "brief",
    hash8(args.runId),
    hash8(args.scheduleEntryId),
    hash8(args.formatId),
  ].join("_");
}

/* -------------------------------------------------------------------------- */
/*                              Convenience predicates                        */
/* -------------------------------------------------------------------------- */

/** True when the brief is a green-lit work order ready for the generator. */
export function isReadyForGenerator(brief: GenerationBrief): boolean {
  return brief.status === "validated";
}

/** True when the brief's status finalises its lifecycle (sets `finalisedAt`). */
export function isFinalised(brief: GenerationBrief): boolean {
  return isFinalisedStatus(brief.status);
}

/** True when the brief is queued for or currently with the generator. */
export function isPendingGenerator(brief: GenerationBrief): boolean {
  return brief.status === "validated" || brief.status === "generating";
}
