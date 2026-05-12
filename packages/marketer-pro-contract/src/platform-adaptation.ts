/**
 * Platform adaptation — copy limits and deterministic reshaping of
 * {@link CopyDirectives} for each {@link PublishableNetwork}.
 *
 * Runtime publishers and LLM prompts use this to keep captions, hashtags,
 * and links within network norms. It does not choose creative direction;
 * it only enforces budgets and records what was trimmed.
 */

import { z } from "zod";

import type { CopyDirectives } from "./generation-brief.js";
import {
  CopyDirectivesSchema,
  COPY_DIRECTIVES_HEADLINE_SUBHEAD_MAX_CHARS,
} from "./generation-brief.js";
import {
  PUBLISHABLE_NETWORKS,
  PublishableNetworkSchema,
  type PublishableNetwork,
} from "./social-connections.js";

/* -------------------------------------------------------------------------- */
/*                                  Rosters                                   */
/* -------------------------------------------------------------------------- */

export const PLATFORM_ADAPTATION_STRATEGIES = [
  "truncate",
  "fail_on_overflow",
] as const;
export type PlatformAdaptationStrategy =
  (typeof PLATFORM_ADAPTATION_STRATEGIES)[number];
export const PlatformAdaptationStrategySchema = z.enum(
  PLATFORM_ADAPTATION_STRATEGIES,
);

export const PLATFORM_ADAPTATION_WARNING_CODES = [
  "primary_text_truncated",
  "hashtags_trimmed",
  "link_cleared_not_supported",
  "overflow_blocked",
] as const;
export type PlatformAdaptationWarningCode =
  (typeof PLATFORM_ADAPTATION_WARNING_CODES)[number];
export const PlatformAdaptationWarningCodeSchema = z.enum(
  PLATFORM_ADAPTATION_WARNING_CODES,
);

/* -------------------------------------------------------------------------- */
/*                           Per-network copy limits                          */
/* -------------------------------------------------------------------------- */

/**
 * Soft limits for social copy. APIs change; treat these as product guardrails
 * for generation and QA, not legal guarantees.
 */
export interface PlatformCopyLimits {
  readonly network: PublishableNetwork;
  /** Combined budget for headline + subhead + body + CTA (joined for measurement). */
  readonly maxPrimaryChars: number;
  readonly maxHashtagCount: number;
  /** When false, callers should omit or move links (e.g. bio / first comment). */
  readonly linkSupportedInPrimary: boolean;
}

const L = (x: PlatformCopyLimits): PlatformCopyLimits => Object.freeze(x);

/**
 * Canonical limit table keyed by {@link PublishableNetwork}.
 */
export const PLATFORM_COPY_LIMITS: Readonly<
  Record<PublishableNetwork, PlatformCopyLimits>
> = Object.freeze({
  facebook: L({
    network: "facebook",
    maxPrimaryChars: 8_000,
    maxHashtagCount: 30,
    linkSupportedInPrimary: true,
  }),
  instagram: L({
    network: "instagram",
    maxPrimaryChars: 2_200,
    maxHashtagCount: 30,
    linkSupportedInPrimary: false,
  }),
  x: L({
    network: "x",
    maxPrimaryChars: 280,
    maxHashtagCount: 10,
    linkSupportedInPrimary: true,
  }),
  linkedin: L({
    network: "linkedin",
    maxPrimaryChars: 3_000,
    maxHashtagCount: 20,
    linkSupportedInPrimary: true,
  }),
  youtube: L({
    network: "youtube",
    maxPrimaryChars: 5_000,
    maxHashtagCount: 15,
    linkSupportedInPrimary: true,
  }),
  tiktok: L({
    network: "tiktok",
    maxPrimaryChars: 2_200,
    maxHashtagCount: 20,
    linkSupportedInPrimary: false,
  }),
  pinterest: L({
    network: "pinterest",
    maxPrimaryChars: 500,
    maxHashtagCount: 20,
    linkSupportedInPrimary: true,
  }),
  snapchat: L({
    network: "snapchat",
    maxPrimaryChars: 250,
    maxHashtagCount: 10,
    linkSupportedInPrimary: false,
  }),
  reddit: L({
    network: "reddit",
    maxPrimaryChars: 40_000,
    maxHashtagCount: 20,
    linkSupportedInPrimary: true,
  }),
  threads: L({
    network: "threads",
    maxPrimaryChars: 500,
    maxHashtagCount: 20,
    linkSupportedInPrimary: false,
  }),
  discord: L({
    network: "discord",
    maxPrimaryChars: 2_000,
    maxHashtagCount: 10,
    linkSupportedInPrimary: true,
  }),
  twitch: L({
    network: "twitch",
    maxPrimaryChars: 500,
    maxHashtagCount: 10,
    linkSupportedInPrimary: true,
  }),
});

/** Limits for a network; throws only on exhaustive-check misuse (never for valid enum). */
export function platformCopyLimits(network: PublishableNetwork): PlatformCopyLimits {
  return PLATFORM_COPY_LIMITS[network];
}

/* -------------------------------------------------------------------------- */
/*                         Adaptation result schemas                          */
/* -------------------------------------------------------------------------- */

export const PlatformAdaptationWarningSchema = z
  .object({
    code: PlatformAdaptationWarningCodeSchema,
    message: z.string().max(500),
    path: z.array(z.string().max(120)).max(20),
  })
  .strict();
export type PlatformAdaptationWarning = z.infer<
  typeof PlatformAdaptationWarningSchema
>;

export const PlatformAdaptationResultSchema = z
  .object({
    network: PublishableNetworkSchema,
    copy: CopyDirectivesSchema,
    strategy: PlatformAdaptationStrategySchema,
    warnings: z.array(PlatformAdaptationWarningSchema).max(40),
    /** Dot-paths into `copy` that were shortened or cleared. */
    truncatedPaths: z.array(z.string().max(120)).max(40),
  })
  .strict();
export type PlatformAdaptationResult = z.infer<
  typeof PlatformAdaptationResultSchema
>;

export interface AdaptCopyToPlatformOptions {
  readonly strategy?: PlatformAdaptationStrategy;
  /** Suffix appended when truncating primary text (counts toward budget). */
  readonly ellipsis?: string;
}

function normalizedHashtags(tags: readonly string[] | undefined): string[] {
  if (!tags?.length) return [];
  return tags.map((t) => (t.startsWith("#") ? t.slice(1) : t));
}

function hashtagBlock(tags: readonly string[]): string {
  if (tags.length === 0) return "";
  return tags.map((t) => `#${t}`).join(" ");
}

/** Length of hashtag suffix including a leading space when non-empty. */
function hashtagSuffixLength(tags: readonly string[]): number {
  const block = hashtagBlock(tags);
  return block.length === 0 ? 0 : block.length + 1;
}

function joinPrimaryParts(copy: CopyDirectives): string {
  const parts = [copy.headline, copy.subhead, copy.body, copy.cta].filter(
    (p): p is string => typeof p === "string" && p.trim().length > 0,
  );
  return parts.join("\n\n");
}

function splitPrimaryToHeadlineBody(
  primary: string,
  headlineSegmentBudget: number,
): Pick<CopyDirectives, "headline" | "subhead" | "body" | "cta"> {
  const lines = primary.split("\n\n");
  const first = lines[0] ?? "";
  const rest = lines.slice(1).join("\n\n");

  if (first.length <= headlineSegmentBudget && rest.length === 0) {
    return { headline: first || undefined, subhead: undefined, body: undefined, cta: undefined };
  }

  if (first.length <= headlineSegmentBudget) {
    return {
      headline: first || undefined,
      subhead: undefined,
      body: rest || undefined,
      cta: undefined,
    };
  }

  return {
    headline: primary.slice(0, headlineSegmentBudget),
    subhead: undefined,
    body: primary.length > headlineSegmentBudget ? primary.slice(headlineSegmentBudget) : undefined,
    cta: undefined,
  };
}

/** First-line / headline chunk budget: schema headline cap, never above platform primary budget. */
function headlineSegmentBudget(limits: PlatformCopyLimits): number {
  return Math.min(
    COPY_DIRECTIVES_HEADLINE_SUBHEAD_MAX_CHARS,
    limits.maxPrimaryChars,
  );
}

/**
 * Maps combined primary text into `CopyDirectives` fields. Uses
 * {@link headlineSegmentBudget} (not a hardcoded 280). For platforms whose
 * primary budget exceeds the headline/subhead schema cap, a single undivided
 * block is stored in `body` so long-form copy is not arbitrarily split at 280.
 */
function splitAdaptedPrimaryIntoCopyFields(
  primary: string,
  limits: PlatformCopyLimits,
): Pick<CopyDirectives, "headline" | "subhead" | "body" | "cta"> {
  const segmentBudget = headlineSegmentBudget(limits);
  const roomy =
    limits.maxPrimaryChars > COPY_DIRECTIVES_HEADLINE_SUBHEAD_MAX_CHARS;

  if (roomy && !primary.includes("\n\n") && primary.length > segmentBudget) {
    return {
      headline: undefined,
      subhead: undefined,
      body: primary || undefined,
      cta: undefined,
    };
  }

  return splitPrimaryToHeadlineBody(primary, segmentBudget);
}

function truncateUtf16(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen);
}

/**
 * Deterministically adapts copy to a target network: trims hashtags, optionally
 * clears unsupported links, and truncates combined primary text to fit
 * {@link platformCopyLimits}. Default strategy is `truncate`.
 *
 * With `fail_on_overflow`, returns a failure-shaped result (empty headline if
 * blocked) and `overflow_blocked` when content exceeds the primary budget
 * even before hashtags.
 */
export function adaptCopyToPlatform(
  source: CopyDirectives,
  network: PublishableNetwork,
  options: AdaptCopyToPlatformOptions = {},
): PlatformAdaptationResult {
  const limits = platformCopyLimits(network);
  const strategy = options.strategy ?? "truncate";
  const ellipsis = options.ellipsis ?? "…";
  const warnings: PlatformAdaptationWarning[] = [];
  const truncatedPaths: string[] = [];

  const rawTags = normalizedHashtags(source.hashtags);
  const tags = rawTags.slice(0, limits.maxHashtagCount);
  if (rawTags.length > tags.length) {
    warnings.push({
      code: "hashtags_trimmed",
      message: `Hashtags reduced from ${rawTags.length} to ${limits.maxHashtagCount} for ${network}.`,
      path: ["hashtags"],
    });
    truncatedPaths.push("hashtags");
  }

  let link = source.link;
  if (link && link.length > 0 && !limits.linkSupportedInPrimary) {
    link = "";
    warnings.push({
      code: "link_cleared_not_supported",
      message: `Links are not modeled as supported in primary text for ${network}; cleared for adaptation.`,
      path: ["link"],
    });
    truncatedPaths.push("link");
  }

  const primaryJoined = joinPrimaryParts(source);
  const hashtagReserve = hashtagSuffixLength(tags);
  const budget = Math.max(0, limits.maxPrimaryChars - hashtagReserve);

  if (strategy === "fail_on_overflow" && primaryJoined.length > budget) {
    const failed: CopyDirectives = {
      headline: undefined,
      subhead: undefined,
      body: undefined,
      cta: undefined,
      hashtags: tags.length ? tags : undefined,
      link: link && link.length > 0 ? link : undefined,
      maxBodyChars: source.maxBodyChars,
    };
    warnings.push({
      code: "overflow_blocked",
      message: `Primary text length ${primaryJoined.length} exceeds budget ${budget} for ${network}.`,
      path: [],
    });
    return PlatformAdaptationResultSchema.parse({
      network,
      copy: CopyDirectivesSchema.parse(failed),
      strategy,
      warnings,
      truncatedPaths: [...truncatedPaths, "headline", "body"],
    });
  }

  let primary = primaryJoined;
  let truncated = false;
  if (primary.length > budget) {
    const room = Math.max(0, budget - ellipsis.length);
    primary = truncateUtf16(primary, room) + ellipsis;
    truncated = true;
  }

  if (truncated) {
    warnings.push({
      code: "primary_text_truncated",
      message: `Primary text truncated to ${limits.maxPrimaryChars} chars (including hashtag reserve) for ${network}.`,
      path: ["headline", "body"],
    });
    truncatedPaths.push("headline", "body");
  }

  const { headline, subhead, body, cta } = splitAdaptedPrimaryIntoCopyFields(
    primary,
    limits,
  );

  const adapted: CopyDirectives = {
    headline,
    subhead,
    body,
    cta,
    hashtags: tags.length ? tags : undefined,
    link: link && link.length > 0 ? link : undefined,
    maxBodyChars: source.maxBodyChars,
  };

  return PlatformAdaptationResultSchema.parse({
    network,
    copy: CopyDirectivesSchema.parse(adapted),
    strategy,
    warnings,
    truncatedPaths: [...new Set(truncatedPaths)],
  });
}

/* -------------------------------------------------------------------------- */
/*                            Validation + review                             */
/* -------------------------------------------------------------------------- */

export const PLATFORM_ADAPTATION_ISSUE_CODES = [
  "primary_exceeds_limit",
  "too_many_hashtags",
  "link_not_supported",
] as const;
export type PlatformAdaptationIssueCode =
  (typeof PLATFORM_ADAPTATION_ISSUE_CODES)[number];
export const PlatformAdaptationIssueCodeSchema = z.enum(
  PLATFORM_ADAPTATION_ISSUE_CODES,
);

export interface PlatformAdaptationIssue {
  readonly code: PlatformAdaptationIssueCode;
  readonly message: string;
  readonly path: readonly string[];
}

export type PlatformAdaptationValidationResult =
  | { ok: true }
  | { ok: false; issues: PlatformAdaptationIssue[] };

/** True if any warning should surface optional human review in the UI. */
export function adaptationWarningsNeedReview(
  warnings: readonly PlatformAdaptationWarning[],
): boolean {
  return warnings.some(
    (w) =>
      w.code === "primary_text_truncated" ||
      w.code === "link_cleared_not_supported" ||
      w.code === "overflow_blocked",
  );
}

/**
 * Validates adapted copy against {@link platformCopyLimits} without mutating.
 */
export function validateAdaptedCopyForNetwork(
  copy: CopyDirectives,
  network: PublishableNetwork,
): PlatformAdaptationValidationResult {
  const limits = platformCopyLimits(network);
  const issues: PlatformAdaptationIssue[] = [];

  const tags = copy.hashtags ?? [];
  if (tags.length > limits.maxHashtagCount) {
    issues.push({
      code: "too_many_hashtags",
      message: `Hashtag count ${tags.length} exceeds max ${limits.maxHashtagCount} for ${network}.`,
      path: ["hashtags"],
    });
  }

  if (copy.link && copy.link.length > 0 && !limits.linkSupportedInPrimary) {
    issues.push({
      code: "link_not_supported",
      message: `Links in primary copy are not supported for ${network} in this contract.`,
      path: ["link"],
    });
  }

  const primary = joinPrimaryParts(copy);
  const reserve = hashtagSuffixLength(tags);
  if (primary.length + reserve > limits.maxPrimaryChars) {
    issues.push({
      code: "primary_exceeds_limit",
      message: `Primary text (${primary.length} chars) plus hashtags exceeds ${limits.maxPrimaryChars} for ${network}.`,
      path: ["headline", "body"],
    });
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/** All publishable networks (for UI / policy iteration). */
export function listPublishableNetworksForAdaptation(): readonly PublishableNetwork[] {
  return PUBLISHABLE_NETWORKS;
}
