import { describe, expect, it } from "vitest";

import type { CopyDirectives } from "./generation-brief.js";
import {
  adaptCopyToPlatform,
  adaptationWarningsNeedReview,
  listPublishableNetworksForAdaptation,
  PLATFORM_COPY_LIMITS,
  platformCopyLimits,
  validateAdaptedCopyForNetwork,
} from "./platform-adaptation.js";
import { PUBLISHABLE_NETWORKS } from "./social-connections.js";

describe("PLATFORM_COPY_LIMITS / platformCopyLimits", () => {
  it("defines limits for every publishable network", () => {
    for (const n of PUBLISHABLE_NETWORKS) {
      const limits = platformCopyLimits(n);
      expect(limits.network).toBe(n);
      expect(limits.maxPrimaryChars).toBeGreaterThan(0);
      expect(limits.maxHashtagCount).toBeGreaterThan(0);
      expect(typeof limits.linkSupportedInPrimary).toBe("boolean");
      expect(PLATFORM_COPY_LIMITS[n]).toBe(limits);
    }
  });

  it("marks Instagram and TikTok as not supporting links in primary", () => {
    expect(platformCopyLimits("instagram").linkSupportedInPrimary).toBe(false);
    expect(platformCopyLimits("tiktok").linkSupportedInPrimary).toBe(false);
    expect(platformCopyLimits("linkedin").linkSupportedInPrimary).toBe(true);
  });
});

describe("adaptCopyToPlatform", () => {
  it("truncates combined primary text for X within maxPrimaryChars", () => {
    const body = "a".repeat(400);
    const source: CopyDirectives = { body };
    const r = adaptCopyToPlatform({ source, network: "x" });

    expect(r.network).toBe("x");
    expect(r.strategy).toBe("truncate");
    const joined =
      [r.copy.headline, r.copy.subhead, r.copy.body, r.copy.cta]
        .filter((p): p is string => typeof p === "string" && p.length > 0)
        .join("\n\n");
    expect(joined.length).toBeLessThanOrEqual(280);
    expect(r.warnings.some((w) => w.code === "primary_text_truncated")).toBe(
      true,
    );
    expect(r.truncatedPaths).toContain("headline");
  });

  it("puts a long single block in body on Instagram (not a 280-char headline cap)", () => {
    const text = "p".repeat(600);
    const source: CopyDirectives = { body: text };
    const r = adaptCopyToPlatform({ source, network: "instagram" });

    expect(r.copy.body?.length).toBe(600);
    expect(r.copy.headline).toBeUndefined();
  });

  it("keeps a short single block in headline on Instagram", () => {
    const r = adaptCopyToPlatform({
      source: { body: "Short launch line." },
      network: "instagram",
    });
    expect(r.copy.headline).toBe("Short launch line.");
    expect(r.copy.body).toBeUndefined();
  });

  it("still splits explicit paragraphs on roomy networks", () => {
    const para1 = "a".repeat(200);
    const para2 = "b".repeat(400);
    const source: CopyDirectives = { body: `${para1}\n\n${para2}` };
    const r = adaptCopyToPlatform({ source, network: "instagram" });

    expect(r.copy.headline).toBe(para1);
    expect(r.copy.body).toBe(para2);
  });

  it("clears unsupported links for Instagram and records a warning", () => {
    const source: CopyDirectives = {
      body: "Launch week",
      link: "https://example.com/p",
    };
    const r = adaptCopyToPlatform({ source, network: "instagram" });

    expect(r.copy.link).toBeUndefined();
    expect(r.warnings.some((w) => w.code === "link_cleared_not_supported")).toBe(
      true,
    );
    expect(r.truncatedPaths).toContain("link");
  });

  it("trims hashtags over the network limit", () => {
    const tags = Array.from({ length: 15 }, (_, i) => `tag${i}`);
    const source: CopyDirectives = {
      body: "Short",
      hashtags: tags,
    };
    const r = adaptCopyToPlatform({ source, network: "x" });

    expect(r.copy.hashtags?.length).toBe(10);
    expect(r.warnings.some((w) => w.code === "hashtags_trimmed")).toBe(true);
  });

  it("normalizes hashtags that already include a leading #", () => {
    const source: CopyDirectives = {
      body: "x",
      hashtags: ["#one", "#two"],
    };
    const r = adaptCopyToPlatform({ source, network: "x" });

    expect(r.copy.hashtags).toEqual(["one", "two"]);
  });

  it("blocks overflow when strategy is fail_on_overflow", () => {
    const source: CopyDirectives = { body: "b".repeat(300) };
    const r = adaptCopyToPlatform({ source, network: "x", options: { strategy: "fail_on_overflow" } });

    expect(r.strategy).toBe("fail_on_overflow");
    expect(r.warnings.some((w) => w.code === "overflow_blocked")).toBe(true);
    expect(r.copy.headline).toBeUndefined();
    expect(r.copy.body).toBeUndefined();
    expect(r.copy.hashtags).toBeUndefined();
  });

  it("preserves trimmed hashtags on fail_on_overflow when primary still overflows", () => {
    const source: CopyDirectives = {
      body: "b".repeat(300),
      hashtags: ["a", "b"],
    };
    const r = adaptCopyToPlatform({ source, network: "x", options: { strategy: "fail_on_overflow" } });
    expect(r.warnings.some((w) => w.code === "overflow_blocked")).toBe(true);
    expect(r.copy.hashtags).toEqual(["a", "b"]);
  });
});

describe("adaptationWarningsNeedReview", () => {
  it("is false when only hashtags were trimmed", () => {
    const source: CopyDirectives = {
      body: "ok",
      hashtags: Array.from({ length: 12 }, (_, i) => `t${i}`),
    };
    const r = adaptCopyToPlatform({ source, network: "x" });
    expect(r.warnings.some((w) => w.code === "hashtags_trimmed")).toBe(true);
    expect(adaptationWarningsNeedReview(r.warnings)).toBe(false);
  });

  it("is true for truncation, cleared link, or overflow", () => {
    const t = adaptCopyToPlatform({ source: { body: "z".repeat(500) }, network: "x" });
    expect(adaptationWarningsNeedReview(t.warnings)).toBe(true);

    const l = adaptCopyToPlatform({
      source: { body: "x", link: "https://example.com/a" },
      network: "instagram",
    });
    expect(adaptationWarningsNeedReview(l.warnings)).toBe(true);

    const o = adaptCopyToPlatform({
      source: { body: "y".repeat(300) },
      network: "x",
      options: { strategy: "fail_on_overflow" },
    });
    expect(adaptationWarningsNeedReview(o.warnings)).toBe(true);
  });
});

describe("validateAdaptedCopyForNetwork", () => {
  it("returns ok for copy within limits", () => {
    const copy: CopyDirectives = { headline: "Hi", body: "There" };
    expect(validateAdaptedCopyForNetwork(copy, "facebook")).toEqual({
      ok: true,
    });
  });

  it("flags link in primary when the network disallows it", () => {
    const copy: CopyDirectives = {
      body: "See link",
      link: "https://example.com/x",
    };
    const v = validateAdaptedCopyForNetwork(copy, "instagram");
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.issues.some((i) => i.code === "link_not_supported")).toBe(true);
    }
  });

  it("flags primary text plus hashtag reserve over limit", () => {
    const limits = platformCopyLimits("x");
    const body = "c".repeat(limits.maxPrimaryChars);
    const copy: CopyDirectives = {
      body,
      hashtags: ["a", "b"],
    };
    const v = validateAdaptedCopyForNetwork(copy, "x");
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(
        v.issues.some((i) => i.code === "primary_exceeds_limit"),
      ).toBe(true);
    }
  });
});

describe("listPublishableNetworksForAdaptation", () => {
  it("returns the canonical publishable network roster", () => {
    expect(listPublishableNetworksForAdaptation()).toBe(PUBLISHABLE_NETWORKS);
  });
});
