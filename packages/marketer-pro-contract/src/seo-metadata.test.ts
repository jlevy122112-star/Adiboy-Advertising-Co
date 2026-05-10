import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEO_WORKSPACE_DEFAULTS,
  deriveOpenGraphDefaults,
  deriveTwitterDefaults,
  IMAGE_ALT_RECOMMENDED_MAX,
  ImageSeoMetadataSchema,
  lintImageSeoMetadata,
  lintSeoMetadata,
  resolveSeoMetadata,
  SEO_DESCRIPTION_RECOMMENDED_MAX,
  SEO_TITLE_RECOMMENDED_MAX,
  SeoMetadataOverrideSchema,
  SeoMetadataSchema,
  SeoWorkspaceDefaultsSchema,
  type SeoMetadata,
} from "./seo-metadata.js";

const completeMeta: SeoMetadata = {
  title: "Best Hiking Trails in Colorado for Beginners",
  metaDescription:
    "Discover the most beginner-friendly hiking trails in Colorado, from short alpine walks to scenic loops with stunning mountain views.",
  secondaryKeywords: ["beginner hiking", "colorado outdoors"],
  focusKeyword: "Hiking Trails",
  canonicalUrl: "https://example.com/hiking-trails-colorado",
  ogType: "article",
  twitterCard: "summary_large_image",
  schemaOrgType: "Article",
  robots: "index,follow",
  hashtags: ["#hiking"],
  ogImageUrl: "https://example.com/hero.webp",
};

describe("SeoMetadataSchema", () => {
  it("accepts a complete record", () => {
    expect(SeoMetadataSchema.safeParse(completeMeta).success).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(
      SeoMetadataSchema.safeParse({ ...completeMeta, title: "" }).success,
    ).toBe(false);
  });

  it("rejects a description above the hard cap", () => {
    expect(
      SeoMetadataSchema.safeParse({
        ...completeMeta,
        metaDescription: "x".repeat(250),
      }).success,
    ).toBe(false);
  });

  it("rejects malformed twitter handles", () => {
    expect(
      SeoMetadataSchema.safeParse({
        ...completeMeta,
        twitterSite: "@bad handle",
      }).success,
    ).toBe(false);
  });

  it("accepts well-formed twitter handles with or without leading @", () => {
    expect(
      SeoMetadataSchema.safeParse({ ...completeMeta, twitterSite: "@brand" })
        .success,
    ).toBe(true);
    expect(
      SeoMetadataSchema.safeParse({ ...completeMeta, twitterSite: "brand" })
        .success,
    ).toBe(true);
  });
});

describe("SeoWorkspaceDefaultsSchema + DEFAULT_SEO_WORKSPACE_DEFAULTS", () => {
  it("parses the shipped defaults", () => {
    expect(
      SeoWorkspaceDefaultsSchema.safeParse(DEFAULT_SEO_WORKSPACE_DEFAULTS)
        .success,
    ).toBe(true);
  });

  it("ships index,follow + summary_large_image card by default", () => {
    expect(DEFAULT_SEO_WORKSPACE_DEFAULTS.robots).toBe("index,follow");
    expect(DEFAULT_SEO_WORKSPACE_DEFAULTS.twitterCard).toBe(
      "summary_large_image",
    );
    expect(DEFAULT_SEO_WORKSPACE_DEFAULTS.schemaOrgType).toBe("Article");
  });

  it("does not require title / metaDescription at the workspace level", () => {
    const r = SeoWorkspaceDefaultsSchema.safeParse({
      secondaryKeywords: [],
      ogType: "article",
      twitterCard: "summary",
      schemaOrgType: "WebPage",
      robots: "index,follow",
      hashtags: [],
    });
    expect(r.success).toBe(true);
  });
});

describe("resolveSeoMetadata (override chain)", () => {
  it("returns workspace defaults plus the asset's title + metaDescription", () => {
    const out = resolveSeoMetadata({
      workspace: DEFAULT_SEO_WORKSPACE_DEFAULTS,
      asset: {
        title: "Asset title",
        metaDescription: "Asset description.",
      },
    });
    expect(out.title).toBe("Asset title");
    expect(out.metaDescription).toBe("Asset description.");
    expect(out.robots).toBe("index,follow");
    expect(out.ogType).toBe("article");
  });

  it("applies the format override on top of workspace + asset", () => {
    const out = resolveSeoMetadata({
      workspace: DEFAULT_SEO_WORKSPACE_DEFAULTS,
      format: { ogType: "video.other", twitterCard: "player" },
      asset: { title: "T", metaDescription: "D" },
    });
    expect(out.ogType).toBe("video.other");
    expect(out.twitterCard).toBe("player");
  });

  it("asset override wins over format override on conflicting keys", () => {
    const out = resolveSeoMetadata({
      workspace: DEFAULT_SEO_WORKSPACE_DEFAULTS,
      format: { robots: "noindex,nofollow" },
      asset: {
        title: "T",
        metaDescription: "D",
        robots: "index,follow",
      },
    });
    expect(out.robots).toBe("index,follow");
  });

  it("returns a value parseable against the full schema", () => {
    const out = resolveSeoMetadata({
      workspace: DEFAULT_SEO_WORKSPACE_DEFAULTS,
      asset: {
        title: "Title",
        metaDescription:
          "A description of meaningful length that includes useful, descriptive words.",
      },
    });
    expect(SeoMetadataSchema.safeParse(out).success).toBe(true);
  });
});

describe("deriveOpenGraphDefaults / deriveTwitterDefaults", () => {
  it("falls back to the page title + description when og fields omitted", () => {
    const og = deriveOpenGraphDefaults(completeMeta);
    expect(og.ogTitle).toBe(completeMeta.title);
    expect(og.ogDescription).toBe(completeMeta.metaDescription);
    expect(og.ogType).toBe("article");
  });

  it("twitter falls through og when twitter-specific fields are omitted", () => {
    const meta: SeoMetadata = {
      ...completeMeta,
      ogTitle: "Custom OG Title",
      ogDescription: "Custom OG Description",
    };
    const tw = deriveTwitterDefaults(meta);
    expect(tw.twitterTitle).toBe("Custom OG Title");
    expect(tw.twitterDescription).toBe("Custom OG Description");
  });
});

describe("lintSeoMetadata", () => {
  it("returns no warnings for a well-shaped record", () => {
    const warnings = lintSeoMetadata(completeMeta);
    expect(warnings).toEqual([]);
  });

  it("warns when title exceeds the recommended length", () => {
    const warnings = lintSeoMetadata({
      ...completeMeta,
      title: "x".repeat(SEO_TITLE_RECOMMENDED_MAX + 5),
    });
    expect(
      warnings.find((w) => w.code === "title_above_recommended_length"),
    ).toBeDefined();
  });

  it("warns when description is too short or too long", () => {
    const short = lintSeoMetadata({
      ...completeMeta,
      metaDescription: "Short.",
    });
    expect(
      short.find((w) => w.code === "description_too_short"),
    ).toBeDefined();
    const long = lintSeoMetadata({
      ...completeMeta,
      metaDescription: "x".repeat(SEO_DESCRIPTION_RECOMMENDED_MAX + 10),
    });
    expect(
      long.find((w) => w.code === "description_above_recommended_length"),
    ).toBeDefined();
  });

  it("warns when canonical URL is missing", () => {
    const warnings = lintSeoMetadata({
      ...completeMeta,
      canonicalUrl: undefined,
    });
    expect(
      warnings.find((w) => w.code === "missing_canonical_url"),
    ).toBeDefined();
  });

  it("warns when focus keyword is missing from title or description", () => {
    const meta: SeoMetadata = {
      ...completeMeta,
      focusKeyword: "kayaking",
    };
    const warnings = lintSeoMetadata(meta);
    expect(
      warnings.find(
        (w) => w.code === "focus_keyword_missing_from_title",
      ),
    ).toBeDefined();
    expect(
      warnings.find(
        (w) => w.code === "focus_keyword_missing_from_description",
      ),
    ).toBeDefined();
  });

  it("warns about summary_large_image with no image", () => {
    const warnings = lintSeoMetadata({
      ...completeMeta,
      ogImageUrl: undefined,
      ogImageAssetId: undefined,
      twitterImageUrl: undefined,
      twitterImageAssetId: undefined,
      twitterCard: "summary_large_image",
    });
    expect(
      warnings.find((w) => w.code === "twitter_card_with_no_image"),
    ).toBeDefined();
  });
});

describe("ImageSeoMetadataSchema", () => {
  it("requires alt text unless decorativeOnly is true", () => {
    const r1 = ImageSeoMetadataSchema.safeParse({
      altText: "",
      decorativeOnly: false,
    });
    expect(r1.success).toBe(false);
    const r2 = ImageSeoMetadataSchema.safeParse({
      altText: "",
      decorativeOnly: true,
    });
    expect(r2.success).toBe(true);
  });

  it("rejects non-kebab filenameSlug values", () => {
    const r = ImageSeoMetadataSchema.safeParse({
      altText: "Hero shot of a mountain",
      decorativeOnly: false,
      filenameSlug: "Hero Shot",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a clean record", () => {
    const r = ImageSeoMetadataSchema.safeParse({
      altText: "Hero shot of a mountain at sunrise",
      decorativeOnly: false,
      filenameSlug: "mountain-sunrise",
      caption: "Front-range, summer 2026.",
      credit: "Brand Inc.",
      license: "CC-BY-4.0",
    });
    expect(r.success).toBe(true);
  });
});

describe("lintImageSeoMetadata", () => {
  it("warns about over-long alt text", () => {
    const warnings = lintImageSeoMetadata({
      altText: "x".repeat(IMAGE_ALT_RECOMMENDED_MAX + 5),
      decorativeOnly: false,
      filenameSlug: "mountain-sunrise",
      credit: "Brand Inc.",
    });
    expect(
      warnings.find((w) => w.code === "alt_text_above_recommended_length"),
    ).toBeDefined();
  });

  it("warns about missing filename slug", () => {
    const warnings = lintImageSeoMetadata({
      altText: "Mountain sunrise",
      decorativeOnly: false,
      credit: "Brand Inc.",
    });
    expect(
      warnings.find((w) => w.code === "filename_slug_missing"),
    ).toBeDefined();
  });

  it("warns when neither credit nor license is set on a published image", () => {
    const warnings = lintImageSeoMetadata({
      altText: "Mountain sunrise",
      decorativeOnly: false,
      filenameSlug: "mountain-sunrise",
    });
    expect(
      warnings.find(
        (w) => w.code === "missing_credit_or_license_for_published_image",
      ),
    ).toBeDefined();
  });
});

describe("SeoMetadataOverrideSchema", () => {
  it("accepts a fully-empty override", () => {
    expect(SeoMetadataOverrideSchema.safeParse({}).success).toBe(true);
  });

  it("rejects unknown fields", () => {
    const r = SeoMetadataOverrideSchema.safeParse({ wat: 1 });
    expect(r.success).toBe(false);
  });
});
