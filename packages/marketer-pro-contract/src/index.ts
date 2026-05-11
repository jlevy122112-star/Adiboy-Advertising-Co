import { z } from "zod";

import { SocialConnectionSchema } from "./social-connections.js";

export {
  BUSINESS_CATEGORY_CATALOG,
  categoryHeroDefaultSrc,
  categoryHeroSizes,
  categoryHeroSrcSet,
  defaultBusinessCategory,
  getBusinessCategory,
  type BusinessCategory,
  type BusinessCategoryHero,
} from "./business-categories.js";

export {
  CONTENT_FORMAT_CATALOG,
  CONTENT_FORMAT_COUNT,
  type ContentFormat,
  pickFormatForSlot,
} from "./content-formats.js";

export {
  CONTENT_ASSET_CATALOG,
  CONTENT_ASSET_CATEGORIES,
  CONTENT_ASSET_COUNT,
  CONTENT_ASSET_NETWORKS,
  findAssetFormatById,
  getAssetFormatsByCategory,
  getAssetFormatsByMedium,
  getAssetFormatsByNetwork,
  groupAssetFormatsByNetwork,
  type ContentAssetCategory,
  type ContentAssetFileType,
  type ContentAssetFormat,
  type ContentAssetMedium,
  type ContentAssetNetwork,
  type ContentAssetSafeZone,
} from "./content-asset-formats.js";

export {
  commitDecision,
  DECISION_CONTROL_MODES,
  DecisionControlModeSchema,
  DecisionOptionSchema,
  DecisionPointSchema,
  DecisionRecordSchema,
  DecisionSourceSchema,
  isDecisionSatisfied,
  resolveCommittedValue,
  validateDecisionRecord,
  type CommitDecisionArgs,
  type DecisionControlMode,
  type DecisionOption,
  type DecisionPoint,
  type DecisionRecord,
  type DecisionSource,
  type DecisionValidationReason,
  type DecisionValidationResult,
} from "./decision-point.js";

export {
  computeBlockedStages,
  DEFAULT_DECISION_POINTS,
  findDecisionPoint,
  getDecisionPointsForStage,
  JOURNEY_STAGE_DESCRIPTORS,
  JOURNEY_STAGES,
  JourneyStageSchema,
  nextRequiredStage,
  type JourneyStage,
  type JourneyStageDescriptor,
} from "./customer-journey.js";

export {
  ConnectionStatusSchema,
  findUsableConnectionsForNetwork,
  isConnectionUsable,
  listConnectedNetworks,
  needsReconnect,
  NETWORK_CAPABILITIES,
  PUBLISHABLE_NETWORKS,
  PublishableNetworkSchema,
  resolvePublishTarget,
  SocialConnectionSchema,
  type ConnectionStatus,
  type NetworkCapabilities,
  type PublishableNetwork,
  type ResolveTargetResult,
  type SocialConnection,
} from "./social-connections.js";

export {
  allowAutonomousAutoCommit,
  AutonomousJobRequestSchema,
  AutonomousJobScopeSchema,
  AutonomyModeSchema,
  AutonomyNotificationPolicySchema,
  DEFAULT_AUTONOMY_NOTIFICATION_POLICY,
  DEFAULT_AUTONOMY_POLICY,
  listMissingConnections,
  listPendingUserOnlyPoints,
  notificationChannelsFor,
  NotificationChannelSchema,
  NotificationReasonSchema,
  planAutonomousCommits,
  validateAutonomousJobPreconditions,
  WorkspaceAutonomyPolicySchema,
  type AutonomousJobRequest,
  type AutonomousJobScope,
  type AutonomousJobValidation,
  type AutonomyMode,
  type AutonomyNotificationPolicy,
  type NotificationChannel,
  type NotificationReason,
  type ValidateAutonomousJobArgs,
  type WorkspaceAutonomyPolicy,
} from "./workspace-autonomy.js";

export {
  ColorProfileSchema,
  DecodingStrategySchema,
  DEFAULT_IMAGE_OPTIMIZATION,
  ImageOptimizationOverrideSchema,
  ImageOptimizationSettingsSchema,
  ImageRenderFormatSchema,
  lintImageOptimization,
  LoadingStrategySchema,
  normaliseSrcsetWidths,
  PrintDpiSchema,
  resolveImageOptimization,
  suggestImageFilenameSlug,
  type ColorProfile,
  type DecodingStrategy,
  type ImageOptimizationOverride,
  type ImageOptimizationSettings,
  type ImageOptimizationWarning,
  type ImageRenderFormat,
  type LoadingStrategy,
  type PrintDpi,
} from "./image-optimization.js";

export {
  DEFAULT_SEO_WORKSPACE_DEFAULTS,
  deriveOpenGraphDefaults,
  deriveTwitterDefaults,
  IMAGE_ALT_HARD_MAX,
  IMAGE_ALT_RECOMMENDED_MAX,
  ImageSeoMetadataSchema,
  lintImageSeoMetadata,
  lintSeoMetadata,
  OpenGraphTypeSchema,
  resolveSeoMetadata,
  RobotsDirectiveSchema,
  SchemaOrgTypeSchema,
  SEO_DESCRIPTION_HARD_MAX,
  SEO_DESCRIPTION_RECOMMENDED_MAX,
  SEO_DESCRIPTION_RECOMMENDED_MIN,
  SEO_TITLE_HARD_MAX,
  SEO_TITLE_RECOMMENDED_MAX,
  SeoMetadataOverrideSchema,
  SeoMetadataSchema,
  SeoWorkspaceDefaultsSchema,
  TwitterCardSchema,
  type ImageSeoMetadata,
  type ImageSeoWarning,
  type OpenGraphType,
  type RobotsDirective,
  type SchemaOrgType,
  type SeoMetadata,
  type SeoMetadataOverride,
  type SeoMetadataWarning,
  type SeoWorkspaceDefaults,
  type TwitterCard,
} from "./seo-metadata.js";

export {
  COLOR_SCALE_STEPS,
  ColorScaleSchema,
  contrastRatio,
  CssDurationSchema,
  CssSizeSchema,
  HexColorSchema,
  meetsContrast,
  MOTION_DURATION_STEPS,
  MotionDurationScaleSchema,
  normaliseHex,
  RADIUS_SCALE_STEPS,
  RadiusScaleSchema,
  relativeLuminance,
  SHADOW_ELEVATION_STEPS,
  ShadowScaleSchema,
  ShadowValueSchema,
  TYPE_SCALE_STEPS,
  TypeScaleSchema,
  WCAG_AA_LARGE,
  WCAG_AA_NORMAL,
  WCAG_AAA_NORMAL,
  WEIGHT_SCALE_STEPS,
  WeightScaleSchema,
  type ColorScale,
  type ColorScaleStep,
  type CssDuration,
  type CssSize,
  type HexColor,
  type MotionDurationScale,
  type MotionDurationStep,
  type RadiusScale,
  type RadiusScaleStep,
  type ShadowElevationStep,
  type ShadowScale,
  type TypeScale,
  type TypeScaleStep,
  type WeightScale,
  type WeightScaleStep,
} from "./brand-theme-tokens.js";

export {
  BRAND_FORMALITIES,
  BRAND_READING_LEVELS,
  BRAND_THEME_WARNING_CODES,
  BrandFormalitySchema,
  BrandPaletteSchema,
  BrandReadingLevelSchema,
  BrandThemeOverrideSchema,
  BrandThemeSchema,
  BrandTypographySchema,
  BrandUiPrefsSchema,
  BrandVoiceSchema,
  brandingToTheme,
  DARK_MODE_STRATEGIES,
  DarkModeStrategySchema,
  DEFAULT_BRAND_THEME,
  DENSITIES,
  DensitySchema,
  FontFamilySchema,
  lintBrandTheme,
  LOGO_VARIANT_KINDS,
  LogoSafeZoneSchema,
  LogoVariantKindSchema,
  LogoVariantSchema,
  MOTION_PREFERENCES,
  MotionPreferenceSchema,
  resolveBrandTheme,
  SemanticColorSchema,
  SemanticPaletteSchema,
  themeToCssVariables,
  themeToTokensJson,
  tintScaleFromHex,
  WATERMARK_MEDIUMS,
  WATERMARK_POSITIONS,
  WatermarkMediumSchema,
  WatermarkPolicySchema,
  WatermarkPositionSchema,
  type BrandFormality,
  type BrandingToThemeOptions,
  type BrandPalette,
  type BrandReadingLevel,
  type BrandTheme,
  type BrandThemeOverride,
  type BrandThemeWarning,
  type BrandThemeWarningCode,
  type BrandThemeWarningSeverity,
  type BrandTypography,
  type BrandUiPrefs,
  type BrandVoice,
  type DarkModeStrategy,
  type Density,
  type FontFamily,
  type LogoSafeZone,
  type LogoVariant,
  type LogoVariantKind,
  type MotionPreference,
  type ResolveBrandThemeArgs,
  type SemanticColor,
  type SemanticPalette,
  type ThemeToCssOptions,
  type WatermarkMedium,
  type WatermarkPolicy,
  type WatermarkPosition,
} from "./brand-theme.js";

export {
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
  type AutonomousRunFailureKind,
  type AutonomousRunState,
  type TransitionRejectionReason,
  type TransitionValidationResult,
} from "./autonomous-run-state.js";

export {
  AUTONOMOUS_RUN_EVENT_TYPES,
  AutonomousRunEventSchema,
  AutonomousRunEventTypeSchema,
  CancelRequestedEventSchema,
  DecisionCommittedEventSchema,
  ErrorEventSchema,
  EVENT_SCHEMAS_BY_TYPE,
  eventCausesStateChange,
  eventToTargetState,
  isAuditOnlyEvent,
  NotificationSentEventSchema,
  PauseRequestedEventSchema,
  ProviderResultEventSchema,
  ResumeRequestedEventSchema,
  StateChangeEventSchema,
  TimeoutEventSchema,
  UserOverrideEventSchema,
  type AutonomousRunEvent,
  type AutonomousRunEventType,
  type CancelRequestedEvent,
  type DecisionCommittedEvent,
  type ErrorEvent,
  type NotificationSentEvent,
  type PauseRequestedEvent,
  type ProviderResultEvent,
  type ResumeRequestedEvent,
  type StateChangeEvent,
  type TimeoutEvent,
  type UserOverrideEvent,
} from "./autonomous-run-events.js";

export {
  applyEvent,
  assetAttempts,
  assetAttemptsExceeded,
  AutonomousRunSchema,
  createRun,
  DEFAULT_RETRY_BUDGET,
  firstSuccessfulPublishOf,
  isInActivePhase,
  isRunComplete,
  isStuck,
  listAllRunStates,
  requiresUserInterrupt,
  RetryBudgetSchema,
  runProgress,
  totalErrorBudgetExceeded,
  userOnlyDecisionsBlocking,
  type ApplyEventOptions,
  type ApplyEventRejection,
  type ApplyEventResult,
  type AutonomousRun,
  type CreateRunArgs,
  type RetryBudget,
  type RunProgress,
} from "./autonomous-run.js";

export {
  capabilityRequiresNetwork,
  compareCapabilityRecords,
  findCapableProviders,
  getProviderCapabilities,
  listAllCapabilities,
  listAllProviders,
  listCapabilitiesOf,
  listProvidersInRegistry,
  PROVIDER_AUTH_METHODS,
  PROVIDER_CAPABILITIES,
  PROVIDER_CAPABILITY_CATALOG,
  PROVIDER_COST_TIERS,
  PROVIDER_IDS,
  PROVIDER_QUALITY_TIERS,
  ProviderAuthMethodSchema,
  ProviderCapabilityRecordSchema,
  ProviderCapabilitySchema,
  ProviderCostTierSchema,
  ProviderIdSchema,
  ProviderQualityTierSchema,
  providerSupports,
  rankCapableProviders,
  selectFirstCapableProvider,
  type CapabilityQuery,
  type ProviderAuthMethod,
  type ProviderCapability,
  type ProviderCapabilityRecord,
  type ProviderCostTier,
  type ProviderId,
  type ProviderQualityTier,
} from "./provider-capability.js";

export {
  BRIEF_FAILURE_KINDS,
  BRIEF_SOURCES,
  BRIEF_STATUSES,
  BriefFailureKindSchema,
  BriefFieldSourcesSchema,
  BriefSourceSchema,
  BriefStatusSchema,
  briefIdFor,
  CopyDirectivesSchema,
  createBrief,
  DesignDirectivesSchema,
  GenerationBriefSchema,
  IMAGERY_DIRECTIONS,
  ImageryDirectionSchema,
  isFinalised,
  isPendingGenerator,
  isReadyForGenerator,
  isTerminalBriefStatus,
  LAYOUT_INTENTS,
  LayoutIntentSchema,
  listAllBriefStatuses,
  PALETTE_MODES,
  PaletteModeSchema,
  recordFieldSource,
  transitionBriefStatus,
  validateBriefForGeneration,
  validateBriefTransition,
  VOICE_TONE_SHIFTS,
  VoiceDirectivesSchema,
  VoiceToneShiftSchema,
  type BriefFailureKind,
  type BriefFieldSources,
  type BriefIssue,
  type BriefIssueCode,
  type BriefSource,
  type BriefStatus,
  type BriefTransitionRejectionReason,
  type BriefTransitionResult,
  type BriefValidationResult,
  type CopyDirectives,
  type CreateBriefArgs,
  type DesignDirectives,
  type GenerationBrief,
  type ImageryDirection,
  type LayoutIntent,
  type PaletteMode,
  type TransitionBriefStatusArgs,
  type TransitionBriefStatusResult,
  type ValidateBriefForGenerationOptions,
  type VoiceDirectives,
  type VoiceToneShift,
} from "./generation-brief.js";

/** Workspace-scoped white-label fields (stored per tenant on `workspaces.branding_json`). */
export const WorkspaceBrandingSchema = z
  .object({
    displayName: z.string().max(120).optional(),
    tagline: z.string().max(280).optional(),
    logoUrl: z
      .string()
      .max(2048)
      .optional()
      .refine(
        (s) => s === undefined || s.length === 0 || /^https:\/\//i.test(s),
        { message: "logoUrl must be https or omitted" },
      ),
    primaryHex: z
      .string()
      .optional()
      .refine(
        (s) =>
          s === undefined || s.length === 0 || /^#([0-9A-Fa-f]{6})$/.test(s),
        { message: "primaryHex must be #RRGGBB or empty" },
      ),
    accentHex: z
      .string()
      .optional()
      .refine(
        (s) =>
          s === undefined || s.length === 0 || /^#([0-9A-Fa-f]{6})$/.test(s),
        { message: "accentHex must be #RRGGBB or empty" },
      ),
    businessCategoryId: z.string().max(64).optional(),
  })
  .strict();

export type WorkspaceBranding = z.infer<typeof WorkspaceBrandingSchema>;

/** Partial update for `PUT /api/v1/marketer/branding` (omit fields you do not change). */
export const BrandingPutSchema = WorkspaceBrandingSchema.partial().strict();

/** Single row in the marketer monthly schedule (API `/api/v1/marketer/state`). */
export const MarketerScheduleEntrySchema = z.object({
  date: z.string(),
  idea: z.string(),
  scheduledAt: z.string().optional(),
  formatId: z.string().optional(),
  formatLabel: z.string().optional(),
  network: z.string().optional(),
  placement: z.string().optional(),
  contentKind: z.string().optional(),
  objective: z.string().optional(),
  creativeType: z.string().optional(),
  aspectRatio: z.string().optional(),
  spec: z.string().optional(),
});

export const MarketerPlanSchema = z.enum(["free", "pro", "enterprise"]);

export const OnboardingStepSchema = z.object({
  id: z.string(),
  label: z.string(),
  done: z.boolean(),
  href: z.string(),
});

export const OnboardingSchema = z.object({
  steps: z.array(OnboardingStepSchema),
  percentComplete: z.number().min(0).max(100),
});

export const AnalyticsDepthSchema = z.enum(["basic", "standard", "advanced"]);

export const MarketerEntitlementsSchema = z.object({
  maxScheduleDays: z.number().int().min(1).max(366),
  canUseAiGenerate: z.boolean(),
  canLivePublish: z.boolean(),
  canUseAutonomousMode: z.boolean(),
  maxVariantLines: z.number().int().min(1).max(80),
  maxSocialConnectionsPerNetwork: z.number().int().min(0).max(1000),
  analyticsDepth: AnalyticsDepthSchema,
});

export type MarketerEntitlements = z.infer<typeof MarketerEntitlementsSchema>;

export {
  marketerEntitlementsForPlan,
  type AnalyticsDepth,
  type MarketerPlan,
} from "./plan-entitlements.js";

/** Starts Stripe Checkout for the signed-in workspace (requires API env price IDs). */
export const SubscriptionCheckoutPostSchema = z
  .object({
    plan: z.enum(["starter", "pro", "enterprise"]),
    successUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
  })
  .strict();

/** Full workspace marketer state returned by most marketer endpoints. */
export const MarketerStateSchema = z.object({
  campaignName: z.string(),
  voice: z.string(),
  offer: z.string(),
  geography: z.string(),
  disclaimers: z.string(),
  timezone: z.string(),
  variants: z.array(z.string()),
  variantsConfirmed: z.boolean(),
  schedule: z.array(MarketerScheduleEntrySchema),
  publishStatus: z.enum(["Draft", "Scheduled", "Published", "Failed"]),
  firstEngagement: z.boolean(),
  socialConnections: z.array(SocialConnectionSchema).default([]),
  branding: WorkspaceBrandingSchema.default({}),
  plan: MarketerPlanSchema,
  onboarding: OnboardingSchema,
  entitlements: MarketerEntitlementsSchema,
  /** ISO timestamp when the user accepted AI features; null if never accepted or revoked. */
  aiConsentAt: z.string().nullable().optional(),
  aiConsentVersion: z.number().int().nullable().optional(),
});

export type MarketerState = z.infer<typeof MarketerStateSchema>;

export const CampaignPutSchema = z
  .object({
    name: z.string().min(1).max(500).optional(),
    voice: z.string().max(2000).optional(),
    offer: z.string().max(2000).optional(),
    geography: z.string().max(500).optional(),
    disclaimers: z.string().max(4000).optional(),
    timezone: z.string().max(120).optional(),
  })
  .strict();

export const VariantsPostSchema = z
  .object({
    variants: z.array(z.string().max(8000)).min(1).max(80),
  })
  .strict();

export const GeneratePostSchema = z
  .object({
    useAi: z.boolean().optional(),
  })
  .strict();

export const MarketerWebhookPublishBodySchema = z.object({
  workspaceId: z.string().uuid(),
  publishStatus: z.enum(["Published", "Failed"]),
});

export const AuthLoginResponseSchema = z.object({
  token: z.string().min(1),
});

export const MetaOAuthUrlResponseSchema = z.object({
  url: z.string().url(),
  state: z.string().min(1),
});

/**
 * Validates marketer state JSON from the API. Throws if the contract drifts.
 */
export function parseMarketerState(data: unknown): MarketerState {
  const parsed = MarketerStateSchema.safeParse(data);
  if (!parsed.success) {
    const err = new Error("marketer_state_validation_failed");
    (err as Error & { cause?: unknown }).cause = parsed.error.flatten();
    throw err;
  }
  return parsed.data;
}
