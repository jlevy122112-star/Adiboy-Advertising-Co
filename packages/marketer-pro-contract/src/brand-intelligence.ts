/**
 * Brand Intelligence Core.
 *
 * Contract-only foundation for brand-aware generation: audience context,
 * brand voice, trusted knowledge sources, and retrieval snippets. Runtime
 * providers/vector stores plug in later; this module stays pure.
 */

import { z } from "zod";

import {
  BrandReadingLevelSchema,
  BrandVoiceSchema,
  type BrandVoice,
} from "./brand-theme.js";
import {
  PublishableNetworkSchema,
  type PublishableNetwork,
} from "./social-connections.js";
import {
  VoiceDirectivesSchema,
  type VoiceDirectives,
} from "./generation-brief.js";

/* -------------------------------------------------------------------------- */
/*                                  Rosters                                   */
/* -------------------------------------------------------------------------- */

export const AUDIENCE_LIFECYCLE_STAGES = [
  "awareness",
  "consideration",
  "conversion",
  "retention",
  "advocacy",
] as const;
export type AudienceLifecycleStage =
  (typeof AUDIENCE_LIFECYCLE_STAGES)[number];
export const AudienceLifecycleStageSchema = z.enum(AUDIENCE_LIFECYCLE_STAGES);

export const BRAND_KNOWLEDGE_SOURCE_KINDS = [
  "website",
  "uploaded_file",
  "product_doc",
  "faq",
  "prior_post",
  "manual_note",
  "serp_result",
  "customer_research",
] as const;
export type BrandKnowledgeSourceKind =
  (typeof BRAND_KNOWLEDGE_SOURCE_KINDS)[number];
export const BrandKnowledgeSourceKindSchema = z.enum(
  BRAND_KNOWLEDGE_SOURCE_KINDS,
);

export const HUMAN_OVERSIGHT_MODES = [
  "optional_review",
  "approval_required",
] as const;
export type HumanOversightMode = (typeof HUMAN_OVERSIGHT_MODES)[number];
export const HumanOversightModeSchema = z.enum(HUMAN_OVERSIGHT_MODES);

export const HUMAN_OVERSIGHT_CHECKPOINTS = [
  "brand_profile",
  "audience_profile",
  "knowledge_selection",
  "generation_context",
  "content_generation",
  "platform_adaptation",
  "calendar_planning",
  "scheduling",
  "publishing",
] as const;
export type HumanOversightCheckpoint =
  (typeof HUMAN_OVERSIGHT_CHECKPOINTS)[number];
export const HumanOversightCheckpointSchema = z.enum(
  HUMAN_OVERSIGHT_CHECKPOINTS,
);

/* -------------------------------------------------------------------------- */
/*                                  Schemas                                   */
/* -------------------------------------------------------------------------- */

export const AudienceProfileSchema = z
  .object({
    audienceId: z.string().min(1).max(120),
    name: z.string().min(1).max(160),
    description: z.string().max(2_000).optional(),
    geography: z.array(z.string().min(1).max(120)).max(40),
    lifecycleStage: AudienceLifecycleStageSchema,
    painPoints: z.array(z.string().min(1).max(280)).max(40),
    goals: z.array(z.string().min(1).max(280)).max(40),
    preferredChannels: z.array(PublishableNetworkSchema).max(12),
    readingLevelHint: BrandReadingLevelSchema.optional(),
    notes: z.string().max(2_000).optional(),
  })
  .strict();
export type AudienceProfile = z.infer<typeof AudienceProfileSchema>;

export const BrandKnowledgeSourceSchema = z
  .object({
    sourceId: z.string().min(1).max(120),
    workspaceId: z.string().min(1).max(120),
    kind: BrandKnowledgeSourceKindSchema,
    title: z.string().min(1).max(240),
    uri: z.string().min(1).max(2_048).optional(),
    tags: z.array(z.string().min(1).max(80)).max(40),
    trusted: z.boolean(),
    summary: z.string().max(2_000).optional(),
    lastIndexedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();
export type BrandKnowledgeSource = z.infer<
  typeof BrandKnowledgeSourceSchema
>;

export const BrandRetrievalSnippetSchema = z
  .object({
    snippetId: z.string().min(1).max(120),
    sourceId: z.string().min(1).max(120),
    citationLabel: z.string().min(1).max(160),
    textExcerpt: z.string().min(1).max(4_000),
    score: z.number().min(0).max(1),
    metadata: z.record(z.string().max(80), z.string().max(500)).optional(),
  })
  .strict();
export type BrandRetrievalSnippet = z.infer<
  typeof BrandRetrievalSnippetSchema
>;

export const HumanOversightPolicySchema = z
  .object({
    /**
     * Product invariant: a human user can always inspect and override AI work.
     * This literal keeps the option explicit in stored/generated contexts.
     */
    enabled: z.literal(true),
    mode: HumanOversightModeSchema,
    checkpoints: z.array(HumanOversightCheckpointSchema).min(1).max(20),
    allowUserOverride: z.literal(true),
    notes: z.string().max(1_000).optional(),
  })
  .strict();
export type HumanOversightPolicy = z.infer<typeof HumanOversightPolicySchema>;

export const DEFAULT_HUMAN_OVERSIGHT_POLICY: HumanOversightPolicy = {
  enabled: true,
  mode: "optional_review",
  checkpoints: [...HUMAN_OVERSIGHT_CHECKPOINTS],
  allowUserOverride: true,
};

/** Required legal / compliance copy surfaced during generation (Phase 1). */
export const BrandRequiredDisclaimerSchema = z
  .object({
    disclaimerId: z.string().min(1).max(120),
    text: z.string().min(1).max(2_000),
    appliesWhen: z.string().max(500).optional(),
  })
  .strict();
export type BrandRequiredDisclaimer = z.infer<
  typeof BrandRequiredDisclaimerSchema
>;

/** Forbidden claims, regulated tags, and disclaimer templates for safe generation. */
export const BrandComplianceRulesSchema = z
  .object({
    forbiddenClaims: z.array(z.string().min(1).max(500)).max(100),
    regulatedContentTags: z.array(z.string().min(1).max(80)).max(40),
    requiredDisclaimers: z.array(BrandRequiredDisclaimerSchema).max(20),
    notes: z.string().max(2_000).optional(),
  })
  .strict();
export type BrandComplianceRules = z.infer<typeof BrandComplianceRulesSchema>;

/** Structured product / service facts the model must respect (Phase 1). */
export const BrandProductFactSchema = z
  .object({
    factId: z.string().min(1).max(120),
    label: z.string().min(1).max(200),
    body: z.string().min(1).max(4_000),
    sourceId: z.string().min(1).max(120).optional(),
  })
  .strict();
export type BrandProductFact = z.infer<typeof BrandProductFactSchema>;

export const BrandIntelligenceProfileSchema = z
  .object({
    profileId: z.string().min(1).max(120),
    workspaceId: z.string().min(1).max(120),
    displayName: z.string().min(1).max(160),
    voice: BrandVoiceSchema,
    audiences: z.array(AudienceProfileSchema).max(50),
    knowledgeSources: z.array(BrandKnowledgeSourceSchema).max(500),
    defaultAudienceId: z.string().min(1).max(120).nullable(),
    humanOversight: HumanOversightPolicySchema,
    /** Optional until UI captures it — generation should treat absence as "not yet specified". */
    compliance: BrandComplianceRulesSchema.optional(),
    productFacts: z.array(BrandProductFactSchema).max(200).optional(),
    version: z.number().int().min(1),
    updatedAt: z.string().datetime(),
  })
  .strict();
export type BrandIntelligenceProfile = z.infer<
  typeof BrandIntelligenceProfileSchema
>;

/**
 * Full-build-plan Phase 1 output name — identical to {@link BrandIntelligenceProfile}.
 * Prefer this alias in product docs; the longer name stays for historical imports.
 */
export const BrandProfileSchema = BrandIntelligenceProfileSchema;
export type BrandProfile = BrandIntelligenceProfile;

/**
 * Full-build-plan Phase 1 output name — same shape as {@link BrandVoice} on the profile.
 */
export const BrandVoiceGuidelinesSchema = BrandVoiceSchema;
export type BrandVoiceGuidelines = BrandVoice;

export const BrandGenerationContextSchema = z
  .object({
    profileId: z.string().min(1).max(120),
    workspaceId: z.string().min(1).max(120),
    displayName: z.string().min(1).max(160),
    voice: BrandVoiceSchema,
    voiceSummary: z.string().min(1).max(4_000),
    audience: AudienceProfileSchema.nullable(),
    retrievalSnippets: z.array(BrandRetrievalSnippetSchema).max(20),
    appliedVoiceDirectives: VoiceDirectivesSchema.optional(),
    trustedSourceIds: z.array(z.string().min(1).max(120)).max(500),
    humanOversight: HumanOversightPolicySchema,
    compliance: BrandComplianceRulesSchema.optional(),
    productFacts: z.array(BrandProductFactSchema).max(200).optional(),
  })
  .strict();
export type BrandGenerationContext = z.infer<
  typeof BrandGenerationContextSchema
>;

/* -------------------------------------------------------------------------- */
/*                              Validation issues                             */
/* -------------------------------------------------------------------------- */

export const BRAND_INTELLIGENCE_ISSUE_CODES = [
  "voice_persona_empty",
  "profile_has_no_audiences",
  "default_audience_missing",
  "no_trusted_knowledge_sources",
] as const;
export type BrandIntelligenceIssueCode =
  (typeof BRAND_INTELLIGENCE_ISSUE_CODES)[number];

export interface BrandIntelligenceIssue {
  readonly code: BrandIntelligenceIssueCode;
  readonly message: string;
  readonly path: readonly string[];
}

export type BrandIntelligenceValidationResult =
  | { ok: true }
  | { ok: false; issues: BrandIntelligenceIssue[] };

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function audienceById(
  audiences: ReadonlyArray<AudienceProfile>,
  audienceId: string | null | undefined,
): AudienceProfile | null {
  if (!audienceId) return null;
  return audiences.find((audience) => audience.audienceId === audienceId) ?? null;
}

function compareSourcesByFreshness(
  a: BrandKnowledgeSource,
  b: BrandKnowledgeSource,
): number {
  const aTime = a.lastIndexedAt ?? a.createdAt;
  const bTime = b.lastIndexedAt ?? b.createdAt;
  const byTime = bTime.localeCompare(aTime);
  if (byTime !== 0) return byTime;
  return a.sourceId.localeCompare(b.sourceId);
}

function compareSnippetsByScore(
  a: BrandRetrievalSnippet,
  b: BrandRetrievalSnippet,
): number {
  const byScore = b.score - a.score;
  if (byScore !== 0) return byScore;
  return a.snippetId.localeCompare(b.snippetId);
}

export interface SelectTrustedKnowledgeSourcesOptions {
  readonly kinds?: ReadonlyArray<BrandKnowledgeSourceKind>;
  readonly tags?: ReadonlyArray<string>;
  readonly limit?: number;
}

export function selectTrustedKnowledgeSources(
  sources: ReadonlyArray<BrandKnowledgeSource>,
  options: SelectTrustedKnowledgeSourcesOptions = {},
): BrandKnowledgeSource[] {
  const kinds = options.kinds ? new Set(options.kinds) : null;
  const tags = options.tags
    ? new Set(options.tags.map((tag) => tag.toLowerCase()))
    : null;
  const limit = options.limit ?? sources.length;

  return sources
    .filter((source) => source.trusted)
    .filter((source) => !kinds || kinds.has(source.kind))
    .filter(
      (source) =>
        !tags ||
        source.tags.some((tag) => tags.has(tag.toLowerCase())),
    )
    .sort(compareSourcesByFreshness)
    .slice(0, limit);
}

export function summarizeBrandVoice(
  voice: BrandVoice,
  directives?: VoiceDirectives,
): string {
  const parts = [
    `Persona: ${voice.persona.trim() || "unspecified"}`,
    `Formality: ${voice.formality}`,
    `Reading level: ${voice.readingLevel}`,
  ];

  if (voice.preferredPhrases.length > 0) {
    parts.push(`Prefer: ${voice.preferredPhrases.join(", ")}`);
  }
  if (voice.bannedPhrases.length > 0) {
    parts.push(`Avoid: ${voice.bannedPhrases.join(", ")}`);
  }
  if (directives?.toneShift) {
    parts.push(`Tone shift: ${directives.toneShift}`);
  }
  if (directives?.formalityOverride) {
    parts.push(`Formality override: ${directives.formalityOverride}/5`);
  }
  if (directives?.preferredPhrasesAdditional?.length) {
    parts.push(
      `Additional preferred phrases: ${directives.preferredPhrasesAdditional.join(
        ", ",
      )}`,
    );
  }
  if (directives?.bannedWordsAdditional?.length) {
    parts.push(
      `Additional banned words: ${directives.bannedWordsAdditional.join(", ")}`,
    );
  }
  if (directives?.note?.trim()) {
    parts.push(`Note: ${directives.note.trim()}`);
  }

  return parts.join("\n").slice(0, 4_000);
}

export function validateBrandIntelligenceProfile(
  profile: BrandIntelligenceProfile,
): BrandIntelligenceValidationResult {
  const issues: BrandIntelligenceIssue[] = [];

  if (profile.voice.persona.trim() === "") {
    issues.push({
      code: "voice_persona_empty",
      message: "voice.persona should describe the brand's speaking style",
      path: ["voice", "persona"],
    });
  }

  if (profile.audiences.length === 0) {
    issues.push({
      code: "profile_has_no_audiences",
      message: "at least one audience profile is recommended for generation",
      path: ["audiences"],
    });
  }

  if (
    profile.defaultAudienceId !== null &&
    !audienceById(profile.audiences, profile.defaultAudienceId)
  ) {
    issues.push({
      code: "default_audience_missing",
      message: "defaultAudienceId must reference an audience in this profile",
      path: ["defaultAudienceId"],
    });
  }

  if (!profile.knowledgeSources.some((source) => source.trusted)) {
    issues.push({
      code: "no_trusted_knowledge_sources",
      message: "at least one trusted knowledge source is recommended",
      path: ["knowledgeSources"],
    });
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

export interface BuildBrandGenerationContextArgs {
  readonly profile: BrandIntelligenceProfile;
  readonly audienceId?: string;
  readonly retrievalSnippets?: ReadonlyArray<BrandRetrievalSnippet>;
  readonly voiceDirectives?: VoiceDirectives;
  readonly humanOversight?: HumanOversightPolicy;
  readonly maxRetrievalSnippets?: number;
}

export function buildBrandGenerationContext(
  args: BuildBrandGenerationContextArgs,
): BrandGenerationContext {
  const { profile } = args;
  const selectedAudience =
    audienceById(profile.audiences, args.audienceId) ??
    audienceById(profile.audiences, profile.defaultAudienceId) ??
    profile.audiences[0] ??
    null;
  const maxRetrievalSnippets = args.maxRetrievalSnippets ?? 8;
  const retrievalSnippets = [...(args.retrievalSnippets ?? [])]
    .sort(compareSnippetsByScore)
    .slice(0, maxRetrievalSnippets);
  const trustedSourceIds = selectTrustedKnowledgeSources(
    profile.knowledgeSources,
  ).map((source) => source.sourceId);

  return BrandGenerationContextSchema.parse({
    profileId: profile.profileId,
    workspaceId: profile.workspaceId,
    displayName: profile.displayName,
    voice: profile.voice,
    voiceSummary: summarizeBrandVoice(profile.voice, args.voiceDirectives),
    audience: selectedAudience,
    retrievalSnippets,
    appliedVoiceDirectives: args.voiceDirectives,
    trustedSourceIds,
    humanOversight: args.humanOversight ?? profile.humanOversight,
    compliance: profile.compliance,
    productFacts: profile.productFacts,
  });
}

/**
 * Deterministic plain-text block for LLM system / developer messages.
 * Surfaces voice, audience, retrieval, compliance, and product facts.
 */
export function formatBrandGenerationContextForPrompt(
  context: BrandGenerationContext,
): string {
  const lines: string[] = [];
  lines.push(`## Brand: ${context.displayName}`);
  lines.push(`workspaceId: ${context.workspaceId}`);
  lines.push(`profileId: ${context.profileId}`);
  lines.push("");
  lines.push("### Voice summary");
  lines.push(context.voiceSummary);
  lines.push("");

  if (context.audience) {
    const a = context.audience;
    lines.push("### Audience");
    lines.push(`- id: ${a.audienceId}`);
    lines.push(`- name: ${a.name}`);
    if (a.description) lines.push(`- description: ${a.description}`);
    lines.push(`- lifecycle: ${a.lifecycleStage}`);
    lines.push(`- geography: ${a.geography.join(", ")}`);
    lines.push(`- preferred channels: ${a.preferredChannels.join(", ")}`);
    lines.push("");
  } else {
    lines.push("### Audience");
    lines.push("(none selected)");
    lines.push("");
  }

  if (context.retrievalSnippets.length > 0) {
    lines.push("### Retrieved knowledge (cite by label when using)");
    for (const s of context.retrievalSnippets) {
      lines.push(`- [${s.citationLabel}] (score ${s.score.toFixed(3)})`);
      lines.push(`  ${s.textExcerpt}`);
    }
    lines.push("");
  }

  if (context.compliance) {
    const c = context.compliance;
    lines.push("### Compliance (must follow)");
    if (c.forbiddenClaims.length > 0) {
      lines.push("Forbidden claims / statements:");
      for (const claim of c.forbiddenClaims) {
        lines.push(`- ${claim}`);
      }
    }
    if (c.regulatedContentTags.length > 0) {
      lines.push(`Regulated content tags: ${c.regulatedContentTags.join(", ")}`);
    }
    if (c.requiredDisclaimers.length > 0) {
      lines.push("Required disclaimers:");
      for (const d of c.requiredDisclaimers) {
        const when = d.appliesWhen ? ` (when: ${d.appliesWhen})` : "";
        lines.push(`- [${d.disclaimerId}]${when}: ${d.text}`);
      }
    }
    if (c.notes?.trim()) {
      lines.push(`Notes: ${c.notes.trim()}`);
    }
    lines.push("");
  }

  if (context.productFacts && context.productFacts.length > 0) {
    lines.push("### Product / service facts (must be accurate)");
    for (const f of context.productFacts) {
      const src = f.sourceId ? ` (source: ${f.sourceId})` : "";
      lines.push(`- **${f.label}**${src}`);
      lines.push(`  ${f.body}`);
    }
    lines.push("");
  }

  lines.push("### Trusted source ids");
  lines.push(
    context.trustedSourceIds.length > 0
      ? context.trustedSourceIds.join(", ")
      : "(none)",
  );

  return lines.join("\n").trimEnd();
}

export function audiencePrefersChannel(
  audience: AudienceProfile,
  network: PublishableNetwork,
): boolean {
  return audience.preferredChannels.includes(network);
}
