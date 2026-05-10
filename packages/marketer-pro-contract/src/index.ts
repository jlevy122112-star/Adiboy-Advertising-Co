import { z } from "zod";

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

export const MarketerEntitlementsSchema = z.object({
  maxScheduleDays: z.number().int().min(1).max(366),
  canUseAiGenerate: z.boolean(),
  canLivePublish: z.boolean(),
  maxVariantLines: z.number().int().min(1).max(80),
});

export type MarketerEntitlements = z.infer<typeof MarketerEntitlementsSchema>;

export {
  marketerEntitlementsForPlan,
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
  socialConnections: z.record(z.string(), z.string()).optional(),
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
