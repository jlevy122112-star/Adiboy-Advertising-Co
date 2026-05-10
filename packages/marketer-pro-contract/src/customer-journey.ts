/**
 * Customer-journey stages and the canonical decision points that fire at
 * each one.
 *
 * Anchored on the four control modes in {@link ./decision-point.ts}. Every
 * point declared here is a real on-screen choice the user gets to make —
 * `user_only`, `ai_with_optional_override`, `user_with_ai_assist`, or
 * `ai_suggest_user_confirm`. See the README ("The Four Control Modes") for
 * the product principle this module enforces.
 *
 * Workspaces inherit `DEFAULT_DECISION_POINTS` and may override individual
 * points (e.g. flip the global default from `ai_suggest_user_confirm` to
 * `user_only` for a privacy-conscious customer).
 */

import { z } from "zod";
import type { DecisionPoint, DecisionRecord } from "./decision-point.js";
import { isDecisionSatisfied } from "./decision-point.js";

/* -------------------------------------------------------------------------- */
/*                                  Stages                                    */
/* -------------------------------------------------------------------------- */

/** Canonical journey stages, in order. */
export const JOURNEY_STAGES = [
  "intake",
  "strategy",
  "format_select",
  "concept",
  "draft_copy",
  "design",
  "seo_meta",
  "review",
  "schedule",
  "publish",
  "measure",
] as const;

export type JourneyStage = (typeof JOURNEY_STAGES)[number];

export const JourneyStageSchema = z.enum(JOURNEY_STAGES);

/** Static descriptor for the stage rail in the UI. */
export interface JourneyStageDescriptor {
  readonly id: JourneyStage;
  readonly label: string;
  readonly description: string;
  /** Default decision-point ids that fire at this stage. */
  readonly decisionPointIds: ReadonlyArray<string>;
  /** Stage may be skipped without committing (vs blocking). */
  readonly skippable: boolean;
}

export const JOURNEY_STAGE_DESCRIPTORS: Readonly<
  Record<JourneyStage, JourneyStageDescriptor>
> = Object.freeze({
  intake: {
    id: "intake",
    label: "Intake",
    description: "Tell us about the campaign: brief, voice, audience, geography.",
    decisionPointIds: ["intake.campaign-brief"],
    skippable: false,
  },
  strategy: {
    id: "strategy",
    label: "Strategy",
    description: "Pick goals, tone, and which networks to publish on.",
    decisionPointIds: ["strategy.goal", "strategy.networks"],
    skippable: false,
  },
  format_select: {
    id: "format_select",
    label: "Formats",
    description:
      "Pick the asset formats to render in (Instagram Reel, LinkedIn cover, blog hero, etc.).",
    decisionPointIds: ["format-select.formats"],
    skippable: false,
  },
  concept: {
    id: "concept",
    label: "Concept",
    description: "Set the big idea and choose creative directions.",
    decisionPointIds: ["concept.direction"],
    skippable: true,
  },
  draft_copy: {
    id: "draft_copy",
    label: "Copy",
    description: "Generate copy variants per format; accept, edit, or rewrite each one.",
    decisionPointIds: ["draft-copy.variants"],
    skippable: false,
  },
  design: {
    id: "design",
    label: "Design",
    description: "Apply colors, layout, and imagery on the design canvas.",
    decisionPointIds: ["design.color-source", "design.layout"],
    skippable: false,
  },
  seo_meta: {
    id: "seo_meta",
    label: "SEO & Metadata",
    description:
      "Titles, alt text, Open Graph, Twitter cards, and schema.org metadata.",
    decisionPointIds: ["seo-meta.alt-text-source", "seo-meta.title-source"],
    skippable: false,
  },
  review: {
    id: "review",
    label: "Review",
    description: "Human review/approval gate before scheduling.",
    decisionPointIds: ["review.approval-policy"],
    skippable: true,
  },
  schedule: {
    id: "schedule",
    label: "Schedule",
    description:
      "Pick dates yourself, let the AI plan them, or have the AI propose and you confirm each one.",
    decisionPointIds: ["schedule.authority", "schedule.dates"],
    skippable: false,
  },
  publish: {
    id: "publish",
    label: "Publish",
    description: "Route to networks. You stay in control of the trigger.",
    decisionPointIds: ["publish.mode"],
    skippable: false,
  },
  measure: {
    id: "measure",
    label: "Measure",
    description: "Track performance and feed results back into the next campaign.",
    decisionPointIds: [],
    skippable: true,
  },
});

/* -------------------------------------------------------------------------- */
/*                          Default decision points                           */
/* -------------------------------------------------------------------------- */

/** Helper that lets us declare points with terse object literals. */
function dp(point: DecisionPoint): DecisionPoint {
  return point;
}

/**
 * The canonical decision points the platform ships with. Every entry uses
 * one of the four control modes in `DecisionControlModeSchema` — there are
 * no hidden defaults and the AI never wins by default.
 */
export const DEFAULT_DECISION_POINTS: ReadonlyArray<DecisionPoint> =
  Object.freeze([
    /* ---------------------------------- intake ---------------------------- */
    dp({
      id: "intake.campaign-brief",
      stage: "intake",
      label: "Campaign brief",
      description:
        "Who is this for, what's the offer, and what tone should we use? You can write it yourself, ask the AI to draft it, or pick from a saved preset.",
      controlMode: "user_with_ai_assist",
      required: true,
      allowMultiSelect: false,
      allowCustomValue: true,
      allowRegenerate: true,
      allowSaveAsPreset: true,
      options: [],
    }),

    /* --------------------------------- strategy --------------------------- */
    dp({
      id: "strategy.goal",
      stage: "strategy",
      label: "Primary campaign goal",
      controlMode: "user_only",
      required: true,
      allowMultiSelect: false,
      allowCustomValue: false,
      allowRegenerate: false,
      allowSaveAsPreset: true,
      options: [
        {
          id: "strategy-goal-awareness",
          label: "Awareness",
          value: { goal: "awareness" },
          source: "system",
        },
        {
          id: "strategy-goal-engagement",
          label: "Engagement",
          value: { goal: "engagement" },
          source: "system",
        },
        {
          id: "strategy-goal-leads",
          label: "Leads / sign-ups",
          value: { goal: "leads" },
          source: "system",
        },
        {
          id: "strategy-goal-sales",
          label: "Sales",
          value: { goal: "sales" },
          source: "system",
        },
        {
          id: "strategy-goal-retention",
          label: "Retention",
          value: { goal: "retention" },
          source: "system",
        },
      ],
    }),
    dp({
      id: "strategy.networks",
      stage: "strategy",
      label: "Which networks to publish on",
      controlMode: "user_with_ai_assist",
      required: true,
      allowMultiSelect: true,
      allowCustomValue: false,
      allowRegenerate: true,
      allowSaveAsPreset: true,
      options: [],
    }),

    /* ------------------------------- format_select ------------------------ */
    dp({
      id: "format-select.formats",
      stage: "format_select",
      label: "Asset formats to render",
      description:
        "Pick from the 130+ Canva-style format catalog. The AI can suggest a starter set; you can add or remove any format before continuing.",
      controlMode: "ai_suggest_user_confirm",
      required: true,
      allowMultiSelect: true,
      allowCustomValue: false,
      allowRegenerate: true,
      allowSaveAsPreset: true,
      options: [],
    }),

    /* --------------------------------- concept ---------------------------- */
    dp({
      id: "concept.direction",
      stage: "concept",
      label: "Creative direction",
      controlMode: "ai_suggest_user_confirm",
      required: false,
      allowMultiSelect: false,
      allowCustomValue: true,
      allowRegenerate: true,
      allowSaveAsPreset: true,
      options: [],
    }),

    /* ------------------------------- draft_copy --------------------------- */
    dp({
      id: "draft-copy.variants",
      stage: "draft_copy",
      label: "Copy variants",
      description:
        "AI proposes a handful of variants per format. Accept, edit inline, or replace any of them.",
      controlMode: "ai_suggest_user_confirm",
      required: true,
      allowMultiSelect: true,
      allowCustomValue: true,
      allowRegenerate: true,
      allowSaveAsPreset: true,
      options: [],
    }),

    /* --------------------------------- design ----------------------------- */
    dp({
      id: "design.color-source",
      stage: "design",
      label: "Where do colors come from?",
      controlMode: "user_only",
      required: true,
      allowMultiSelect: false,
      allowCustomValue: false,
      allowRegenerate: false,
      allowSaveAsPreset: false,
      options: [
        {
          id: "design-color-brand",
          label: "Use my brand theme",
          value: { mode: "brand_theme" },
          source: "system",
        },
        {
          id: "design-color-ai",
          label: "Let the AI choose a palette",
          value: { mode: "ai_palette" },
          source: "system",
        },
        {
          id: "design-color-manual",
          label: "I'll pick colors myself",
          value: { mode: "manual" },
          source: "system",
        },
      ],
      defaultOptionId: "design-color-brand",
    }),
    dp({
      id: "design.layout",
      stage: "design",
      label: "Layout for each asset",
      controlMode: "ai_suggest_user_confirm",
      required: true,
      allowMultiSelect: false,
      allowCustomValue: true,
      allowRegenerate: true,
      allowSaveAsPreset: true,
      options: [],
    }),

    /* --------------------------------- seo_meta --------------------------- */
    dp({
      id: "seo-meta.title-source",
      stage: "seo_meta",
      label: "How should we set page titles + meta descriptions?",
      controlMode: "ai_with_optional_override",
      required: true,
      allowMultiSelect: false,
      allowCustomValue: true,
      allowRegenerate: true,
      allowSaveAsPreset: true,
      options: [
        {
          id: "seo-title-ai-auto",
          label: "AI writes title + description; I edit if I want",
          value: { mode: "ai_auto" },
          source: "system",
        },
        {
          id: "seo-title-ai-suggest",
          label: "AI proposes; I confirm each one",
          value: { mode: "ai_suggest" },
          source: "system",
        },
        {
          id: "seo-title-manual",
          label: "I write all titles + descriptions myself",
          value: { mode: "manual" },
          source: "system",
        },
      ],
      defaultOptionId: "seo-title-ai-auto",
    }),
    dp({
      id: "seo-meta.alt-text-source",
      stage: "seo_meta",
      label: "How should we set image alt text?",
      controlMode: "ai_with_optional_override",
      required: true,
      allowMultiSelect: false,
      allowCustomValue: true,
      allowRegenerate: true,
      allowSaveAsPreset: true,
      options: [
        {
          id: "seo-alt-ai-auto",
          label: "AI generates alt text per image; I can edit",
          value: { mode: "ai_auto" },
          source: "system",
        },
        {
          id: "seo-alt-ai-suggest",
          label: "AI suggests; I confirm each image",
          value: { mode: "ai_suggest" },
          source: "system",
        },
        {
          id: "seo-alt-manual",
          label: "I write every alt text myself",
          value: { mode: "manual" },
          source: "system",
        },
      ],
      defaultOptionId: "seo-alt-ai-auto",
    }),

    /* --------------------------------- review ----------------------------- */
    dp({
      id: "review.approval-policy",
      stage: "review",
      label: "Approval policy before scheduling",
      controlMode: "user_only",
      required: false,
      allowMultiSelect: false,
      allowCustomValue: false,
      allowRegenerate: false,
      allowSaveAsPreset: true,
      options: [
        {
          id: "review-approval-self",
          label: "I'll approve everything myself",
          value: { mode: "self" },
          source: "system",
        },
        {
          id: "review-approval-team",
          label: "Send to a teammate for approval",
          value: { mode: "team" },
          source: "system",
        },
        {
          id: "review-approval-skip",
          label: "Skip review (auto-approve)",
          value: { mode: "skip" },
          source: "system",
        },
      ],
      defaultOptionId: "review-approval-self",
    }),

    /* --------------------------------- schedule --------------------------- */
    dp({
      id: "schedule.authority",
      stage: "schedule",
      label: "How should we set publish dates?",
      description:
        "Pick dates yourself, let the AI plan them, or have the AI propose dates and you confirm each one.",
      controlMode: "user_only",
      required: true,
      allowMultiSelect: false,
      allowCustomValue: false,
      allowRegenerate: false,
      allowSaveAsPreset: true,
      options: [
        {
          id: "schedule-authority-manual",
          label: "I'll pick every date",
          description: "You assign each post a date and time.",
          value: { mode: "manual" },
          source: "system",
        },
        {
          id: "schedule-authority-ai-confirm",
          label: "AI suggests dates, I confirm each one",
          description:
            "AI proposes optimal times based on your goals, audience, and history. You accept, edit, or replace each suggestion.",
          value: { mode: "ai_suggest" },
          source: "system",
        },
        {
          id: "schedule-authority-ai-auto",
          label: "AI schedules everything for me",
          description:
            "AI fills the calendar automatically. You can still edit any individual date afterwards.",
          value: { mode: "ai_auto" },
          source: "system",
        },
      ],
      defaultOptionId: "schedule-authority-ai-confirm",
    }),
    dp({
      id: "schedule.dates",
      stage: "schedule",
      label: "Publish dates",
      description:
        "The actual list of dates for each scheduled post. Generated according to the authority you chose above. Always editable.",
      controlMode: "ai_with_optional_override",
      required: true,
      allowMultiSelect: true,
      allowCustomValue: true,
      allowRegenerate: true,
      allowSaveAsPreset: false,
      options: [],
    }),

    /* --------------------------------- publish ---------------------------- */
    dp({
      id: "publish.mode",
      stage: "publish",
      label: "Publish mode",
      controlMode: "user_only",
      required: true,
      allowMultiSelect: false,
      allowCustomValue: false,
      allowRegenerate: false,
      allowSaveAsPreset: true,
      options: [
        {
          id: "publish-mode-live",
          label: "Publish live at scheduled times",
          value: { mode: "live" },
          source: "system",
        },
        {
          id: "publish-mode-staged",
          label: "Stage drafts on each network; I'll publish manually",
          value: { mode: "staged" },
          source: "system",
        },
        {
          id: "publish-mode-export",
          label: "Just export the assets — don't connect to networks",
          value: { mode: "export_only" },
          source: "system",
        },
      ],
      defaultOptionId: "publish-mode-live",
    }),
  ]);

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

/** Get the canonical decision points for a stage. */
export function getDecisionPointsForStage(
  stage: JourneyStage,
  catalog: ReadonlyArray<DecisionPoint> = DEFAULT_DECISION_POINTS,
): DecisionPoint[] {
  return catalog.filter((p) => p.stage === stage);
}

/** Find a default point by id (string match). */
export function findDecisionPoint(
  id: string,
  catalog: ReadonlyArray<DecisionPoint> = DEFAULT_DECISION_POINTS,
): DecisionPoint | undefined {
  return catalog.find((p) => p.id === id);
}

/**
 * Compute which journey stages are "blocked" — i.e. have at least one
 * required decision point with no committed record. Returned in canonical
 * stage order so the UI can display "next thing to do".
 */
export function computeBlockedStages(
  records: ReadonlyArray<DecisionRecord>,
  catalog: ReadonlyArray<DecisionPoint> = DEFAULT_DECISION_POINTS,
): JourneyStage[] {
  const out: JourneyStage[] = [];
  for (const stage of JOURNEY_STAGES) {
    const pts = catalog.filter((p) => p.stage === stage);
    const allSatisfied = pts.every((p) => isDecisionSatisfied(p, records));
    if (!allSatisfied) out.push(stage);
  }
  return out;
}

/** Returns the next stage that has unmet required decision points (or null). */
export function nextRequiredStage(
  records: ReadonlyArray<DecisionRecord>,
  catalog: ReadonlyArray<DecisionPoint> = DEFAULT_DECISION_POINTS,
): JourneyStage | null {
  const blocked = computeBlockedStages(records, catalog);
  return blocked.length > 0 ? blocked[0] : null;
}
