import { describe, expect, it } from "vitest";
import {
  CONTENT_ASSET_CATALOG,
  CONTENT_ASSET_CATEGORIES,
  CONTENT_ASSET_COUNT,
  CONTENT_ASSET_NETWORKS,
  findAssetFormatById,
  getAssetFormatsByCategory,
  getAssetFormatsByMedium,
  getAssetFormatsByNetwork,
  groupAssetFormatsByNetwork,
  type ContentAssetFileType,
  type ContentAssetFormat,
  type ContentAssetNetwork,
} from "./content-asset-formats.js";

const ALLOWED_FILETYPES: ReadonlyArray<ContentAssetFileType> = [
  "png",
  "jpg",
  "webp",
  "mp4",
  "mov",
  "gif",
  "pdf",
];

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ASPECT_RATIO_LABEL = /^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/;

const networksThatMustExist: ContentAssetNetwork[] = [
  "facebook",
  "instagram",
  "x",
  "linkedin",
  "youtube",
  "tiktok",
  "pinterest",
  "snapchat",
  "reddit",
  "threads",
  "discord",
  "twitch",
  "email",
  "web",
  "print",
  "podcast",
  "generic",
];

describe("content-asset-formats catalog", () => {
  it("publishes a sizeable catalog (>=120 entries) and matches its count export", () => {
    expect(CONTENT_ASSET_CATALOG.length).toBeGreaterThanOrEqual(120);
    expect(CONTENT_ASSET_COUNT).toBe(CONTENT_ASSET_CATALOG.length);
  });

  it("freezes the catalog so consumers cannot mutate it in place", () => {
    expect(Object.isFrozen(CONTENT_ASSET_CATALOG)).toBe(true);
    expect(() => {
      (CONTENT_ASSET_CATALOG as ContentAssetFormat[]).push({
        id: "should-fail",
        label: "x",
        network: "generic",
        networkLabel: "Generic",
        category: "generic",
        medium: "image",
        widthPx: 1,
        heightPx: 1,
        aspectRatio: "1:1",
        recommendedFormats: ["png"],
      });
    }).toThrow();
  });

  it("freezes the network and category lists", () => {
    expect(Object.isFrozen(CONTENT_ASSET_NETWORKS)).toBe(true);
    expect(Object.isFrozen(CONTENT_ASSET_CATEGORIES)).toBe(true);
  });

  it("uses globally unique kebab-case ids", () => {
    const seen = new Set<string>();
    for (const f of CONTENT_ASSET_CATALOG) {
      expect(KEBAB.test(f.id), `id "${f.id}" is not kebab-case`).toBe(true);
      expect(seen.has(f.id), `duplicate id ${f.id}`).toBe(false);
      seen.add(f.id);
    }
    expect(seen.size).toBe(CONTENT_ASSET_CATALOG.length);
  });

  it("never emits empty labels or recommendedFormats", () => {
    for (const f of CONTENT_ASSET_CATALOG) {
      expect(f.label.length, `${f.id}.label is empty`).toBeGreaterThan(0);
      expect(
        f.networkLabel.length,
        `${f.id}.networkLabel is empty`,
      ).toBeGreaterThan(0);
      expect(
        f.recommendedFormats.length,
        `${f.id} has no recommendedFormats`,
      ).toBeGreaterThan(0);
    }
  });

  it("uses only positive integer pixel dimensions", () => {
    for (const f of CONTENT_ASSET_CATALOG) {
      expect(Number.isInteger(f.widthPx), `${f.id}.widthPx not int`).toBe(true);
      expect(Number.isInteger(f.heightPx), `${f.id}.heightPx not int`).toBe(
        true,
      );
      expect(f.widthPx, `${f.id}.widthPx <= 0`).toBeGreaterThan(0);
      expect(f.heightPx, `${f.id}.heightPx <= 0`).toBeGreaterThan(0);
    }
  });

  it("computes aspect ratios that match the dimensions within rounding", () => {
    for (const f of CONTENT_ASSET_CATALOG) {
      expect(
        ASPECT_RATIO_LABEL.test(f.aspectRatio),
        `${f.id}.aspectRatio "${f.aspectRatio}" is not w:h`,
      ).toBe(true);
      const [a, b] = f.aspectRatio.split(":").map(Number);
      // Tolerate decimal fallback labels by rounding to 2dp.
      const labelRatio = a / b;
      const dimRatio = f.widthPx / f.heightPx;
      expect(
        Math.abs(labelRatio - dimRatio),
        `${f.id} aspect label ${f.aspectRatio} vs ${f.widthPx}x${f.heightPx}`,
      ).toBeLessThan(0.02);
    }
  });

  it("uses only the documented file types in recommendedFormats", () => {
    const allowed = new Set<ContentAssetFileType>(ALLOWED_FILETYPES);
    for (const f of CONTENT_ASSET_CATALOG) {
      for (const ft of f.recommendedFormats) {
        expect(
          allowed.has(ft),
          `${f.id} uses unknown recommendedFormat ${ft}`,
        ).toBe(true);
      }
    }
  });

  it("pairs medium with appropriate file types", () => {
    for (const f of CONTENT_ASSET_CATALOG) {
      if (f.medium === "video") {
        const hasVideoType = f.recommendedFormats.some(
          (ft) => ft === "mp4" || ft === "mov",
        );
        expect(
          hasVideoType,
          `${f.id} is video but recommendedFormats has no mp4/mov`,
        ).toBe(true);
      }
      if (f.medium === "gif") {
        expect(
          f.recommendedFormats.includes("gif"),
          `${f.id} is gif but recommendedFormats has no gif`,
        ).toBe(true);
      }
    }
  });

  it("keeps safeZone insets within the canvas bounds when supplied", () => {
    for (const f of CONTENT_ASSET_CATALOG) {
      if (!f.safeZone) continue;
      const { topPx, bottomPx, leftPx, rightPx } = f.safeZone;
      expect(topPx, `${f.id}.safeZone.topPx negative`).toBeGreaterThanOrEqual(
        0,
      );
      expect(
        bottomPx,
        `${f.id}.safeZone.bottomPx negative`,
      ).toBeGreaterThanOrEqual(0);
      expect(leftPx, `${f.id}.safeZone.leftPx negative`).toBeGreaterThanOrEqual(
        0,
      );
      expect(
        rightPx,
        `${f.id}.safeZone.rightPx negative`,
      ).toBeGreaterThanOrEqual(0);
      expect(
        topPx + bottomPx,
        `${f.id} vertical safe insets exceed height`,
      ).toBeLessThan(f.heightPx);
      expect(
        leftPx + rightPx,
        `${f.id} horizontal safe insets exceed width`,
      ).toBeLessThan(f.widthPx);
    }
  });

  it("only attaches maxDurationSeconds to time-based mediums", () => {
    for (const f of CONTENT_ASSET_CATALOG) {
      if (f.maxDurationSeconds === undefined) continue;
      expect(
        f.medium === "video" ||
          f.medium === "gif" ||
          f.medium === "animated_image",
        `${f.id} has maxDurationSeconds but medium is ${f.medium}`,
      ).toBe(true);
      expect(f.maxDurationSeconds).toBeGreaterThan(0);
    }
  });
});

describe("network + category indexes", () => {
  it("includes every known network in CONTENT_ASSET_NETWORKS", () => {
    for (const network of networksThatMustExist) {
      expect(
        CONTENT_ASSET_NETWORKS.includes(network),
        `${network} missing from CONTENT_ASSET_NETWORKS`,
      ).toBe(true);
    }
  });

  it("returns at least one format for every network in the network list", () => {
    for (const network of CONTENT_ASSET_NETWORKS) {
      const set = getAssetFormatsByNetwork(network);
      expect(
        set.length,
        `network ${network} returned 0 formats`,
      ).toBeGreaterThan(0);
      for (const f of set) {
        expect(f.network).toBe(network);
      }
    }
  });

  it("returns at least one format for every category in the category list", () => {
    for (const category of CONTENT_ASSET_CATEGORIES) {
      const set = getAssetFormatsByCategory(category);
      expect(
        set.length,
        `category ${category} returned 0 formats`,
      ).toBeGreaterThan(0);
      for (const f of set) {
        expect(f.category).toBe(category);
      }
    }
  });

  it("filters by medium correctly", () => {
    const images = getAssetFormatsByMedium("image");
    const videos = getAssetFormatsByMedium("video");
    expect(images.length).toBeGreaterThan(0);
    expect(videos.length).toBeGreaterThan(0);
    expect(images.every((f) => f.medium === "image")).toBe(true);
    expect(videos.every((f) => f.medium === "video")).toBe(true);
  });

  it("smoke-counts a few key networks to catch silent regressions", () => {
    expect(getAssetFormatsByNetwork("facebook").length).toBeGreaterThanOrEqual(
      10,
    );
    expect(getAssetFormatsByNetwork("instagram").length).toBeGreaterThanOrEqual(
      10,
    );
    expect(getAssetFormatsByNetwork("youtube").length).toBeGreaterThanOrEqual(
      6,
    );
    expect(getAssetFormatsByNetwork("linkedin").length).toBeGreaterThanOrEqual(
      8,
    );
    expect(getAssetFormatsByNetwork("web").length).toBeGreaterThanOrEqual(8);
    expect(getAssetFormatsByNetwork("print").length).toBeGreaterThanOrEqual(4);
  });
});

describe("findAssetFormatById", () => {
  it("returns the entry for a known id", () => {
    const fb = findAssetFormatById("fb-profile-picture");
    expect(fb?.id).toBe("fb-profile-picture");
    expect(fb?.network).toBe("facebook");
    expect(fb?.widthPx).toBe(320);
    expect(fb?.heightPx).toBe(320);
    expect(fb?.aspectRatio).toBe("1:1");
  });

  it("returns undefined for an unknown id", () => {
    expect(findAssetFormatById("nope-not-real")).toBeUndefined();
  });
});

describe("groupAssetFormatsByNetwork", () => {
  it("returns every catalog entry exactly once across all groups", () => {
    const grouped = groupAssetFormatsByNetwork();
    let total = 0;
    for (const network of CONTENT_ASSET_NETWORKS) {
      total += grouped[network].length;
    }
    expect(total).toBe(CONTENT_ASSET_CATALOG.length);
  });

  it("places each entry in the bucket that matches its network field", () => {
    const grouped = groupAssetFormatsByNetwork();
    for (const network of CONTENT_ASSET_NETWORKS) {
      for (const f of grouped[network]) {
        expect(f.network).toBe(network);
      }
    }
  });
});
