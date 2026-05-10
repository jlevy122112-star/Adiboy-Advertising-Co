/**
 * SEO metadata contract — page-level and per-image.
 *
 * Drives the `seo_meta` journey stage. Every field is user-editable;
 * the AI fills sensible defaults when the user delegates ("AI auto" or
 * "AI suggest" on the `seo-meta.title-source` and `seo-meta.alt-text-source`
 * decision points). The renderer reads these schemas at publish time to
 * stamp `<title>`, `<meta>`, `<link rel="canonical">`, OG / Twitter / JSON-LD
 * tags onto the published HTML.
 *
 * Soft limits (warnings, not errors) follow Google Search and the major
 * social previews:
 *
 * - `title` — 50–60 chars before search-result truncation; hard limit 70.
 * - `metaDescription` — 50–160 chars before SERP truncation; hard limit 200.
 * - image `altText` — required by GSC; ≤ 125 chars per WCAG.
 *
 * SEO settings flow through the same workspace → format → asset override
 * chain as `image-optimization.ts`. See {@link resolveSeoMetadata}.
 */

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*                                  Enums                                     */
/* -------------------------------------------------------------------------- */

/**
 * Open Graph / Twitter Card content type. Drives which tags get emitted.
 * Mirrors `og:type` values; see https://ogp.me/ for the full vocabulary —
 * we ship the common ones.
 */
export const OpenGraphTypeSchema = z.enum([
  "website",
  "article",
  "product",
  "video.other",
  "music.song",
  "profile",
]);
export type OpenGraphType = z.infer<typeof OpenGraphTypeSchema>;

export const TwitterCardSchema = z.enum([
  "summary",
  "summary_large_image",
  "app",
  "player",
]);
export type TwitterCard = z.infer<typeof TwitterCardSchema>;

/**
 * The schema.org type the page describes. We surface the main marketing
 * options; custom JSON-LD goes in `schemaOrgJson` for everything else.
 */
export const SchemaOrgTypeSchema = z.enum([
  "Article",
  "BlogPosting",
  "NewsArticle",
  "Product",
  "Event",
  "Recipe",
  "VideoObject",
  "ImageObject",
  "Organization",
  "Person",
  "WebPage",
  "FAQPage",
  "HowTo",
  "Review",
  "LocalBusiness",
]);
export type SchemaOrgType = z.infer<typeof SchemaOrgTypeSchema>;

/** `<meta name="robots">` directive. */
export const RobotsDirectiveSchema = z.enum([
  "index,follow",
  "index,nofollow",
  "noindex,follow",
  "noindex,nofollow",
]);
export type RobotsDirective = z.infer<typeof RobotsDirectiveSchema>;

/* -------------------------------------------------------------------------- */
/*                         Page-level SEO metadata                            */
/* -------------------------------------------------------------------------- */

/** Soft length budgets — used by lint warnings, not the schema parser. */
export const SEO_TITLE_RECOMMENDED_MAX = 60;
export const SEO_TITLE_HARD_MAX = 70;
export const SEO_DESCRIPTION_RECOMMENDED_MIN = 50;
export const SEO_DESCRIPTION_RECOMMENDED_MAX = 160;
export const SEO_DESCRIPTION_HARD_MAX = 200;
export const IMAGE_ALT_RECOMMENDED_MAX = 125;
export const IMAGE_ALT_HARD_MAX = 250;

export const SeoMetadataSchema = z
  .object({
    /** Required. The `<title>` tag, also default for OG / Twitter title. */
    title: z.string().min(1).max(SEO_TITLE_HARD_MAX),
    /**
     * Optional template like `"{title} | {brand}"`. The renderer
     * substitutes `{title}`, `{brand}`, and `{separator}`.
     */
    titleTemplate: z.string().max(120).optional(),
    /** Required. The `<meta name="description">` value. */
    metaDescription: z.string().min(1).max(SEO_DESCRIPTION_HARD_MAX),
    focusKeyword: z.string().max(120).optional(),
    secondaryKeywords: z.array(z.string().min(1).max(120)).max(20),
    /** Optional `<link rel="canonical">` URL. */
    canonicalUrl: z.string().url().max(2048).optional(),
    /** OG title; defaults to `title` when omitted. */
    ogTitle: z.string().max(SEO_TITLE_HARD_MAX).optional(),
    ogDescription: z
      .string()
      .max(SEO_DESCRIPTION_HARD_MAX)
      .optional(),
    /** Asset id of the OG image (resolved at render time). */
    ogImageAssetId: z.string().max(120).optional(),
    /** Optional explicit OG image URL (overrides `ogImageAssetId`). */
    ogImageUrl: z.string().url().max(2048).optional(),
    ogType: OpenGraphTypeSchema,
    /** Locale tag, e.g. `"en_US"`. */
    ogLocale: z.string().max(10).optional(),
    /** Brand name; rendered as `og:site_name`. */
    ogSiteName: z.string().max(120).optional(),
    twitterCard: TwitterCardSchema,
    twitterTitle: z.string().max(SEO_TITLE_HARD_MAX).optional(),
    twitterDescription: z
      .string()
      .max(SEO_DESCRIPTION_HARD_MAX)
      .optional(),
    twitterImageAssetId: z.string().max(120).optional(),
    twitterImageUrl: z.string().url().max(2048).optional(),
    /** `@brand`-style site handle. */
    twitterSite: z
      .string()
      .max(40)
      .regex(/^@?[A-Za-z0-9_]{1,30}$/, { message: "twitter_handle_invalid" })
      .optional(),
    twitterCreator: z
      .string()
      .max(40)
      .regex(/^@?[A-Za-z0-9_]{1,30}$/, { message: "twitter_handle_invalid" })
      .optional(),
    schemaOrgType: SchemaOrgTypeSchema,
    /**
     * Custom JSON-LD object stamped under `<script type="application/ld+json">`.
     * Authoritative when present; the renderer otherwise builds a minimal
     * record from `schemaOrgType + title + ogImageUrl`.
     */
    schemaOrgJson: z.record(z.string(), z.unknown()).optional(),
    robots: RobotsDirectiveSchema,
    hashtags: z.array(z.string().min(1).max(60)).max(30),
  })
  .strict();
export type SeoMetadata = z.infer<typeof SeoMetadataSchema>;

export const SeoMetadataOverrideSchema =
  SeoMetadataSchema.partial().strict();
export type SeoMetadataOverride = z.infer<typeof SeoMetadataOverrideSchema>;

/**
 * Subset suitable for workspace defaults — `title` and `metaDescription`
 * become per-content-piece values, so they are not part of the workspace
 * baseline. Everything else is.
 */
export const SeoWorkspaceDefaultsSchema = SeoMetadataSchema.partial({
  title: true,
  metaDescription: true,
}).strict();
export type SeoWorkspaceDefaults = z.infer<
  typeof SeoWorkspaceDefaultsSchema
>;

export const DEFAULT_SEO_WORKSPACE_DEFAULTS: SeoWorkspaceDefaults = {
  secondaryKeywords: [],
  ogType: "article",
  twitterCard: "summary_large_image",
  schemaOrgType: "Article",
  robots: "index,follow",
  hashtags: [],
};

/* -------------------------------------------------------------------------- */
/*                           Image-level SEO metadata                         */
/* -------------------------------------------------------------------------- */

export const ImageSeoMetadataSchema = z
  .object({
    /**
     * Required. Renders as `<img alt="…">` and is what GSC and screen
     * readers consume. Empty string only valid when `decorativeOnly`.
     */
    altText: z.string().max(IMAGE_ALT_HARD_MAX),
    /** Optional `<img title="…">` tooltip. */
    titleAttribute: z.string().max(SEO_TITLE_HARD_MAX).optional(),
    /** Optional caption (rendered as `<figcaption>` when present). */
    caption: z.string().max(2000).optional(),
    /** Photo credit shown alongside the image. */
    credit: z.string().max(280).optional(),
    /**
     * Optional license string (free-form for proprietary images, or an
     * SPDX-style identifier such as `"CC-BY-4.0"`).
     */
    license: z.string().max(120).optional(),
    /**
     * Marks the image as decorative. When true, an empty `altText` is
     * acceptable; the renderer emits `alt=""`.
     */
    decorativeOnly: z.boolean(),
    focusKeyword: z.string().max(120).optional(),
    /** Suggested kebab-case filename slug for the rendered output. */
    filenameSlug: z
      .string()
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        message: "filename_slug_must_be_kebab",
      })
      .optional(),
    /** Optional geographic location (city, region) for `og:image:alt` regional context. */
    locationLabel: z.string().max(120).optional(),
  })
  .strict()
  .refine(
    (v) => v.decorativeOnly || v.altText.trim().length > 0,
    { message: "alt_text_required_unless_decorative" },
  );
export type ImageSeoMetadata = z.infer<typeof ImageSeoMetadataSchema>;

/* -------------------------------------------------------------------------- */
/*                          Override resolution                               */
/* -------------------------------------------------------------------------- */

function applyOverrides<T extends object>(
  base: T,
  overrides: ReadonlyArray<Partial<T> | undefined>,
): T {
  let out: T = { ...base };
  for (const ov of overrides) {
    if (!ov) continue;
    out = { ...out, ...ov };
  }
  return out;
}

/**
 * Merge workspace defaults + format override + asset override into a final
 * `SeoMetadata`. `title` and `metaDescription` are required at the asset
 * layer because the workspace baseline cannot meaningfully default them.
 */
export function resolveSeoMetadata(args: {
  readonly workspace: SeoWorkspaceDefaults;
  readonly format?: SeoMetadataOverride;
  readonly asset: { title: string; metaDescription: string } & SeoMetadataOverride;
}): SeoMetadata {
  // Materialise the workspace baseline into a full SeoMetadata starting
  // point by attaching the asset's title + description, then layer.
  const base: SeoMetadata = {
    title: args.asset.title,
    metaDescription: args.asset.metaDescription,
    secondaryKeywords: args.workspace.secondaryKeywords ?? [],
    ogType: args.workspace.ogType ?? "article",
    twitterCard: args.workspace.twitterCard ?? "summary_large_image",
    schemaOrgType: args.workspace.schemaOrgType ?? "Article",
    robots: args.workspace.robots ?? "index,follow",
    hashtags: args.workspace.hashtags ?? [],
    titleTemplate: args.workspace.titleTemplate,
    focusKeyword: args.workspace.focusKeyword,
    canonicalUrl: args.workspace.canonicalUrl,
    ogTitle: args.workspace.ogTitle,
    ogDescription: args.workspace.ogDescription,
    ogImageAssetId: args.workspace.ogImageAssetId,
    ogImageUrl: args.workspace.ogImageUrl,
    ogLocale: args.workspace.ogLocale,
    ogSiteName: args.workspace.ogSiteName,
    twitterTitle: args.workspace.twitterTitle,
    twitterDescription: args.workspace.twitterDescription,
    twitterImageAssetId: args.workspace.twitterImageAssetId,
    twitterImageUrl: args.workspace.twitterImageUrl,
    twitterSite: args.workspace.twitterSite,
    twitterCreator: args.workspace.twitterCreator,
    schemaOrgJson: args.workspace.schemaOrgJson,
  };
  return applyOverrides(base, [args.format, args.asset]);
}

/**
 * Derive Open Graph defaults from the page-level metadata — used at render
 * time so the writer doesn't have to repeat themselves.
 */
export function deriveOpenGraphDefaults(meta: SeoMetadata): {
  ogTitle: string;
  ogDescription: string;
  ogType: OpenGraphType;
} {
  return {
    ogTitle: meta.ogTitle ?? meta.title,
    ogDescription: meta.ogDescription ?? meta.metaDescription,
    ogType: meta.ogType,
  };
}

export function deriveTwitterDefaults(meta: SeoMetadata): {
  twitterCard: TwitterCard;
  twitterTitle: string;
  twitterDescription: string;
} {
  return {
    twitterCard: meta.twitterCard,
    twitterTitle: meta.twitterTitle ?? meta.ogTitle ?? meta.title,
    twitterDescription:
      meta.twitterDescription ?? meta.ogDescription ?? meta.metaDescription,
  };
}

/* -------------------------------------------------------------------------- */
/*                               Lint warnings                                */
/* -------------------------------------------------------------------------- */

/** Tagged warnings the UI can render under each editable field. */
export type SeoMetadataWarning =
  | { code: "title_too_short"; length: number }
  | { code: "title_above_recommended_length"; length: number }
  | { code: "description_too_short"; length: number }
  | { code: "description_above_recommended_length"; length: number }
  | { code: "missing_canonical_url" }
  | { code: "focus_keyword_missing_from_title"; focusKeyword: string }
  | { code: "focus_keyword_missing_from_description"; focusKeyword: string }
  | { code: "no_secondary_keywords" }
  | { code: "twitter_card_with_no_image"; card: TwitterCard };

export function lintSeoMetadata(meta: SeoMetadata): SeoMetadataWarning[] {
  const out: SeoMetadataWarning[] = [];
  const titleLen = meta.title.length;
  const descLen = meta.metaDescription.length;

  if (titleLen < 15) out.push({ code: "title_too_short", length: titleLen });
  if (titleLen > SEO_TITLE_RECOMMENDED_MAX) {
    out.push({
      code: "title_above_recommended_length",
      length: titleLen,
    });
  }
  if (descLen < SEO_DESCRIPTION_RECOMMENDED_MIN) {
    out.push({ code: "description_too_short", length: descLen });
  }
  if (descLen > SEO_DESCRIPTION_RECOMMENDED_MAX) {
    out.push({
      code: "description_above_recommended_length",
      length: descLen,
    });
  }
  if (!meta.canonicalUrl) {
    out.push({ code: "missing_canonical_url" });
  }
  if (meta.focusKeyword) {
    const fk = meta.focusKeyword.toLowerCase();
    if (!meta.title.toLowerCase().includes(fk)) {
      out.push({
        code: "focus_keyword_missing_from_title",
        focusKeyword: meta.focusKeyword,
      });
    }
    if (!meta.metaDescription.toLowerCase().includes(fk)) {
      out.push({
        code: "focus_keyword_missing_from_description",
        focusKeyword: meta.focusKeyword,
      });
    }
  }
  if (meta.secondaryKeywords.length === 0) {
    out.push({ code: "no_secondary_keywords" });
  }
  const twitterImage = meta.twitterImageUrl ?? meta.twitterImageAssetId;
  const ogImage = meta.ogImageUrl ?? meta.ogImageAssetId;
  if (
    meta.twitterCard === "summary_large_image" &&
    !twitterImage &&
    !ogImage
  ) {
    out.push({ code: "twitter_card_with_no_image", card: meta.twitterCard });
  }
  return out;
}

/** Tagged warnings for the per-image SEO record. */
export type ImageSeoWarning =
  | { code: "alt_text_above_recommended_length"; length: number }
  | { code: "alt_text_blank_but_not_marked_decorative" }
  | { code: "filename_slug_missing"; suggested?: string }
  | { code: "missing_credit_or_license_for_published_image" };

export function lintImageSeoMetadata(meta: ImageSeoMetadata): ImageSeoWarning[] {
  const out: ImageSeoWarning[] = [];
  if (!meta.decorativeOnly && meta.altText.trim().length === 0) {
    out.push({ code: "alt_text_blank_but_not_marked_decorative" });
  }
  if (meta.altText.length > IMAGE_ALT_RECOMMENDED_MAX) {
    out.push({
      code: "alt_text_above_recommended_length",
      length: meta.altText.length,
    });
  }
  if (!meta.filenameSlug) {
    out.push({ code: "filename_slug_missing" });
  }
  if (!meta.credit && !meta.license) {
    out.push({ code: "missing_credit_or_license_for_published_image" });
  }
  return out;
}
