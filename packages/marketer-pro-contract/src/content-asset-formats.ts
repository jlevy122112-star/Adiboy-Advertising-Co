/**
 * Canva-style asset-format catalog.
 *
 * Lives ALONGSIDE {@link ./content-formats.ts}. They answer different questions:
 *
 * - `content-formats.ts` — "WHERE will this run + WHAT objective + WHAT creative
 *   type" (Instagram Reels carousel ad with leads objective). Powers the
 *   scheduler / publisher matrix.
 * - `content-asset-formats.ts` (this file) — "WHAT exact pixel dimensions and
 *   safe-zones does the asset need". Powers the design-canvas template
 *   chooser, the AI image/video generator size-picker, and the export-bundle
 *   format list.
 *
 * Both files use the same `network` strings (e.g. `"facebook"`, `"linkedin"`)
 * so the UI can join them.
 *
 * This catalog is intentionally data-heavy — robustness comes from coverage
 * of every common asset spec across major networks, plus a generic + print
 * tail for offline use.
 *
 * Specs are sourced from the publishers' creator/business help centers as of
 * 2026-Q2 and may drift. Treat the values as "good defaults"; surface
 * `reference` URLs in the UI when present so end-users can verify.
 */

/** Coarse delivery medium of the asset; drives template + generator pipelines. */
export type ContentAssetMedium =
  | "image"
  | "video"
  | "gif"
  | "animated_image";

/** What the asset is FOR — drives template grouping and filter chips. */
export type ContentAssetCategory =
  | "profile_picture"
  | "cover_photo"
  | "header_banner"
  | "channel_art"
  | "post"
  | "story"
  | "reel"
  | "ad"
  | "thumbnail"
  | "highlight_cover"
  | "pin"
  | "icon"
  | "logo"
  | "print"
  | "web_banner"
  | "email_graphic"
  | "presentation"
  | "endscreen"
  | "watermark"
  | "panel"
  | "podcast_cover"
  | "generic";

/** Top-level network the asset targets. `"generic"` covers no-platform assets. */
export type ContentAssetNetwork =
  | "facebook"
  | "instagram"
  | "x"
  | "linkedin"
  | "youtube"
  | "tiktok"
  | "pinterest"
  | "snapchat"
  | "reddit"
  | "threads"
  | "discord"
  | "twitch"
  | "email"
  | "web"
  | "print"
  | "podcast"
  | "generic";

/** Pixel inset (from each edge) where critical content should never sit — e.g. circular profile mask, mobile-clip on cover photos. */
export interface ContentAssetSafeZone {
  readonly topPx: number;
  readonly rightPx: number;
  readonly bottomPx: number;
  readonly leftPx: number;
}

/** Recommended file formats for export. */
export type ContentAssetFileType =
  | "png"
  | "jpg"
  | "webp"
  | "mp4"
  | "mov"
  | "gif"
  | "pdf";

export interface ContentAssetFormat {
  /** Stable kebab-case id. Globally unique across the catalog. */
  readonly id: string;
  /** Human label shown in UI ("Facebook profile picture"). */
  readonly label: string;
  /** Optional one-line tooltip / longer description. */
  readonly description?: string;
  readonly network: ContentAssetNetwork;
  readonly networkLabel: string;
  readonly category: ContentAssetCategory;
  readonly medium: ContentAssetMedium;
  /** Canvas width in pixels. */
  readonly widthPx: number;
  /** Canvas height in pixels. */
  readonly heightPx: number;
  /**
   * Display aspect ratio (e.g. `"1:1"`, `"9:16"`). Always reduced to lowest
   * integer ratio when possible; falls back to a decimal label like `"3.91:1"`.
   */
  readonly aspectRatio: string;
  /** Recommended file formats, ordered best-first. */
  readonly recommendedFormats: ReadonlyArray<ContentAssetFileType>;
  /** Optional max file size in bytes for the network's upload cap. */
  readonly maxFileBytes?: number;
  /** Optional max video duration in seconds. */
  readonly maxDurationSeconds?: number;
  /** Optional safe-zone insets (e.g. mobile-side crop on Facebook cover). */
  readonly safeZone?: ContentAssetSafeZone;
  /** Optional URL to the official spec page. */
  readonly reference?: string;
}

/* -------------------------------------------------------------------------- */
/*                                Helpers                                     */
/* -------------------------------------------------------------------------- */

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Reduce `width:height` to its lowest-integer ratio, e.g. 1080×1920 → "9:16". */
function aspectFor(width: number, height: number): string {
  if (width <= 0 || height <= 0) {
    throw new Error(`asset_format_invalid_dims:${width}x${height}`);
  }
  const g = gcd(width, height);
  const w = width / g;
  const h = height / g;
  /** When either side reduces to a non-integer ratio (rare, sanity guard). */
  if (!Number.isInteger(w) || !Number.isInteger(h)) {
    return `${(width / height).toFixed(2)}:1`;
  }
  return `${w}:${h}`;
}

/**
 * Builder helper used by every section below. Computes `aspectRatio` so the
 * data table can stay tight (no manual ratio strings = no drift between
 * dimensions and label).
 */
type FormatSeed = Omit<ContentAssetFormat, "aspectRatio">;

function fmt(seed: FormatSeed): ContentAssetFormat {
  return {
    ...seed,
    aspectRatio: aspectFor(seed.widthPx, seed.heightPx),
  };
}

const IMG: ReadonlyArray<ContentAssetFileType> = ["png", "jpg", "webp"];
const VID: ReadonlyArray<ContentAssetFileType> = ["mp4", "mov"];
const PRINT: ReadonlyArray<ContentAssetFileType> = ["pdf", "png"];

const MB = 1024 * 1024;

/* -------------------------------------------------------------------------- */
/*                                Facebook                                    */
/* -------------------------------------------------------------------------- */

const facebook: ContentAssetFormat[] = [
  fmt({
    id: "fb-profile-picture",
    label: "Facebook profile picture",
    description:
      "Displays as a 170×170 circle on desktop, 128×128 on mobile. Upload a square at 320×320 minimum for crispness.",
    network: "facebook",
    networkLabel: "Facebook",
    category: "profile_picture",
    medium: "image",
    widthPx: 320,
    heightPx: 320,
    recommendedFormats: IMG,
    maxFileBytes: 4 * MB,
    safeZone: { topPx: 16, rightPx: 16, bottomPx: 16, leftPx: 16 },
  }),
  fmt({
    id: "fb-cover-photo",
    label: "Facebook page cover photo",
    description:
      "Displays 820×312 on desktop, 640×360 on mobile — keep critical text inside the central safe zone.",
    network: "facebook",
    networkLabel: "Facebook",
    category: "cover_photo",
    medium: "image",
    widthPx: 1640,
    heightPx: 924,
    recommendedFormats: IMG,
    maxFileBytes: 8 * MB,
    safeZone: { topPx: 90, rightPx: 320, bottomPx: 90, leftPx: 320 },
  }),
  fmt({
    id: "fb-event-cover",
    label: "Facebook event cover",
    network: "facebook",
    networkLabel: "Facebook",
    category: "cover_photo",
    medium: "image",
    widthPx: 1920,
    heightPx: 1005,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "fb-group-cover",
    label: "Facebook group cover",
    network: "facebook",
    networkLabel: "Facebook",
    category: "cover_photo",
    medium: "image",
    widthPx: 1640,
    heightPx: 856,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "fb-feed-square",
    label: "Facebook feed post (square)",
    network: "facebook",
    networkLabel: "Facebook",
    category: "post",
    medium: "image",
    widthPx: 1080,
    heightPx: 1080,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "fb-feed-portrait",
    label: "Facebook feed post (portrait 4:5)",
    network: "facebook",
    networkLabel: "Facebook",
    category: "post",
    medium: "image",
    widthPx: 1080,
    heightPx: 1350,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "fb-feed-landscape",
    label: "Facebook feed post (landscape 16:9)",
    network: "facebook",
    networkLabel: "Facebook",
    category: "post",
    medium: "image",
    widthPx: 1920,
    heightPx: 1080,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "fb-story",
    label: "Facebook story (image)",
    network: "facebook",
    networkLabel: "Facebook",
    category: "story",
    medium: "image",
    widthPx: 1080,
    heightPx: 1920,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "fb-story-video",
    label: "Facebook story (video)",
    network: "facebook",
    networkLabel: "Facebook",
    category: "story",
    medium: "video",
    widthPx: 1080,
    heightPx: 1920,
    maxDurationSeconds: 60,
    recommendedFormats: VID,
  }),
  fmt({
    id: "fb-reels",
    label: "Facebook Reels",
    network: "facebook",
    networkLabel: "Facebook",
    category: "reel",
    medium: "video",
    widthPx: 1080,
    heightPx: 1920,
    maxDurationSeconds: 90,
    recommendedFormats: VID,
  }),
  fmt({
    id: "fb-link-ad",
    label: "Facebook link-click ad",
    network: "facebook",
    networkLabel: "Facebook",
    category: "ad",
    medium: "image",
    widthPx: 1200,
    heightPx: 628,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "fb-carousel-card",
    label: "Facebook carousel card",
    network: "facebook",
    networkLabel: "Facebook",
    category: "ad",
    medium: "image",
    widthPx: 1080,
    heightPx: 1080,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "fb-marketplace-ad",
    label: "Facebook Marketplace ad",
    network: "facebook",
    networkLabel: "Facebook",
    category: "ad",
    medium: "image",
    widthPx: 1200,
    heightPx: 628,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "fb-video-ad",
    label: "Facebook in-feed video ad",
    network: "facebook",
    networkLabel: "Facebook",
    category: "ad",
    medium: "video",
    widthPx: 1280,
    heightPx: 720,
    maxDurationSeconds: 240,
    recommendedFormats: VID,
  }),
  fmt({
    id: "fb-page-tab",
    label: "Facebook page tab image",
    network: "facebook",
    networkLabel: "Facebook",
    category: "icon",
    medium: "image",
    widthPx: 111,
    heightPx: 74,
    recommendedFormats: IMG,
  }),
];

/* -------------------------------------------------------------------------- */
/*                                Instagram                                   */
/* -------------------------------------------------------------------------- */

const instagram: ContentAssetFormat[] = [
  fmt({
    id: "ig-profile-picture",
    label: "Instagram profile picture",
    description: "Displays as a 110×110 circle on mobile.",
    network: "instagram",
    networkLabel: "Instagram",
    category: "profile_picture",
    medium: "image",
    widthPx: 320,
    heightPx: 320,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "ig-feed-square",
    label: "Instagram feed (square)",
    network: "instagram",
    networkLabel: "Instagram",
    category: "post",
    medium: "image",
    widthPx: 1080,
    heightPx: 1080,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "ig-feed-portrait",
    label: "Instagram feed (portrait 4:5)",
    description: "The tallest aspect Instagram allows in-feed.",
    network: "instagram",
    networkLabel: "Instagram",
    category: "post",
    medium: "image",
    widthPx: 1080,
    heightPx: 1350,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "ig-feed-landscape",
    label: "Instagram feed (landscape 1.91:1)",
    network: "instagram",
    networkLabel: "Instagram",
    category: "post",
    medium: "image",
    widthPx: 1080,
    heightPx: 566,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "ig-story",
    label: "Instagram story",
    network: "instagram",
    networkLabel: "Instagram",
    category: "story",
    medium: "image",
    widthPx: 1080,
    heightPx: 1920,
    recommendedFormats: IMG,
    safeZone: { topPx: 250, rightPx: 0, bottomPx: 250, leftPx: 0 },
  }),
  fmt({
    id: "ig-story-video",
    label: "Instagram story (video)",
    network: "instagram",
    networkLabel: "Instagram",
    category: "story",
    medium: "video",
    widthPx: 1080,
    heightPx: 1920,
    maxDurationSeconds: 60,
    recommendedFormats: VID,
  }),
  fmt({
    id: "ig-reels",
    label: "Instagram Reels",
    network: "instagram",
    networkLabel: "Instagram",
    category: "reel",
    medium: "video",
    widthPx: 1080,
    heightPx: 1920,
    maxDurationSeconds: 90,
    recommendedFormats: VID,
  }),
  fmt({
    id: "ig-reels-cover",
    label: "Instagram Reels cover",
    network: "instagram",
    networkLabel: "Instagram",
    category: "thumbnail",
    medium: "image",
    widthPx: 1080,
    heightPx: 1920,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "ig-highlight-cover",
    label: "Instagram highlight cover",
    network: "instagram",
    networkLabel: "Instagram",
    category: "highlight_cover",
    medium: "image",
    widthPx: 1080,
    heightPx: 1920,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "ig-carousel-card",
    label: "Instagram carousel slide",
    network: "instagram",
    networkLabel: "Instagram",
    category: "post",
    medium: "image",
    widthPx: 1080,
    heightPx: 1080,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "ig-feed-ad-square",
    label: "Instagram feed ad (square)",
    network: "instagram",
    networkLabel: "Instagram",
    category: "ad",
    medium: "image",
    widthPx: 1080,
    heightPx: 1080,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "ig-feed-ad-portrait",
    label: "Instagram feed ad (4:5)",
    network: "instagram",
    networkLabel: "Instagram",
    category: "ad",
    medium: "image",
    widthPx: 1080,
    heightPx: 1350,
    recommendedFormats: IMG,
  }),
];

/* -------------------------------------------------------------------------- */
/*                                  X / Twitter                               */
/* -------------------------------------------------------------------------- */

const x: ContentAssetFormat[] = [
  fmt({
    id: "x-profile-picture",
    label: "X profile picture",
    network: "x",
    networkLabel: "X",
    category: "profile_picture",
    medium: "image",
    widthPx: 400,
    heightPx: 400,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "x-header",
    label: "X header (cover) image",
    description:
      "Mobile crops top + bottom — keep important content vertically centered.",
    network: "x",
    networkLabel: "X",
    category: "header_banner",
    medium: "image",
    widthPx: 1500,
    heightPx: 500,
    recommendedFormats: IMG,
    safeZone: { topPx: 60, rightPx: 0, bottomPx: 60, leftPx: 0 },
  }),
  fmt({
    id: "x-post-landscape",
    label: "X post image (landscape 16:9)",
    network: "x",
    networkLabel: "X",
    category: "post",
    medium: "image",
    widthPx: 1600,
    heightPx: 900,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "x-post-square",
    label: "X post image (square)",
    network: "x",
    networkLabel: "X",
    category: "post",
    medium: "image",
    widthPx: 1080,
    heightPx: 1080,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "x-card",
    label: "X website card image",
    network: "x",
    networkLabel: "X",
    category: "ad",
    medium: "image",
    widthPx: 1200,
    heightPx: 628,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "x-video-landscape",
    label: "X video (landscape)",
    network: "x",
    networkLabel: "X",
    category: "post",
    medium: "video",
    widthPx: 1280,
    heightPx: 720,
    maxDurationSeconds: 140,
    recommendedFormats: VID,
  }),
  fmt({
    id: "x-video-portrait",
    label: "X video (portrait 9:16)",
    network: "x",
    networkLabel: "X",
    category: "post",
    medium: "video",
    widthPx: 720,
    heightPx: 1280,
    maxDurationSeconds: 140,
    recommendedFormats: VID,
  }),
  fmt({
    id: "x-gif",
    label: "X animated GIF",
    network: "x",
    networkLabel: "X",
    category: "post",
    medium: "gif",
    widthPx: 800,
    heightPx: 800,
    maxFileBytes: 15 * MB,
    recommendedFormats: ["gif"],
  }),
];

/* -------------------------------------------------------------------------- */
/*                                  LinkedIn                                  */
/* -------------------------------------------------------------------------- */

const linkedin: ContentAssetFormat[] = [
  fmt({
    id: "li-profile-picture",
    label: "LinkedIn profile picture",
    network: "linkedin",
    networkLabel: "LinkedIn",
    category: "profile_picture",
    medium: "image",
    widthPx: 400,
    heightPx: 400,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "li-cover-personal",
    label: "LinkedIn personal cover",
    network: "linkedin",
    networkLabel: "LinkedIn",
    category: "cover_photo",
    medium: "image",
    widthPx: 1584,
    heightPx: 396,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "li-company-logo",
    label: "LinkedIn company logo",
    network: "linkedin",
    networkLabel: "LinkedIn",
    category: "logo",
    medium: "image",
    widthPx: 300,
    heightPx: 300,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "li-company-cover",
    label: "LinkedIn company page cover",
    network: "linkedin",
    networkLabel: "LinkedIn",
    category: "cover_photo",
    medium: "image",
    widthPx: 1128,
    heightPx: 191,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "li-company-hero",
    label: "LinkedIn company hero image",
    network: "linkedin",
    networkLabel: "LinkedIn",
    category: "header_banner",
    medium: "image",
    widthPx: 1128,
    heightPx: 376,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "li-post-landscape",
    label: "LinkedIn post image (landscape)",
    network: "linkedin",
    networkLabel: "LinkedIn",
    category: "post",
    medium: "image",
    widthPx: 1200,
    heightPx: 627,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "li-post-square",
    label: "LinkedIn post image (square)",
    network: "linkedin",
    networkLabel: "LinkedIn",
    category: "post",
    medium: "image",
    widthPx: 1080,
    heightPx: 1080,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "li-document",
    label: "LinkedIn document carousel page",
    description: "Each PDF page renders one carousel card.",
    network: "linkedin",
    networkLabel: "LinkedIn",
    category: "post",
    medium: "image",
    widthPx: 1080,
    heightPx: 1350,
    recommendedFormats: PRINT,
  }),
  fmt({
    id: "li-article-cover",
    label: "LinkedIn article cover",
    network: "linkedin",
    networkLabel: "LinkedIn",
    category: "header_banner",
    medium: "image",
    widthPx: 1920,
    heightPx: 1080,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "li-newsletter-cover",
    label: "LinkedIn newsletter cover",
    network: "linkedin",
    networkLabel: "LinkedIn",
    category: "cover_photo",
    medium: "image",
    widthPx: 300,
    heightPx: 300,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "li-sponsored-square",
    label: "LinkedIn sponsored content (square)",
    network: "linkedin",
    networkLabel: "LinkedIn",
    category: "ad",
    medium: "image",
    widthPx: 1080,
    heightPx: 1080,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "li-sponsored-landscape",
    label: "LinkedIn sponsored content (landscape)",
    network: "linkedin",
    networkLabel: "LinkedIn",
    category: "ad",
    medium: "image",
    widthPx: 1200,
    heightPx: 627,
    recommendedFormats: IMG,
  }),
];

/* -------------------------------------------------------------------------- */
/*                                  YouTube                                   */
/* -------------------------------------------------------------------------- */

const youtube: ContentAssetFormat[] = [
  fmt({
    id: "yt-profile-picture",
    label: "YouTube channel profile picture",
    network: "youtube",
    networkLabel: "YouTube",
    category: "profile_picture",
    medium: "image",
    widthPx: 800,
    heightPx: 800,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "yt-channel-art",
    label: "YouTube channel banner / art",
    description:
      "Renders differently on TV / desktop / mobile — protect logo + name within the central 1546×423 safe area.",
    network: "youtube",
    networkLabel: "YouTube",
    category: "channel_art",
    medium: "image",
    widthPx: 2560,
    heightPx: 1440,
    recommendedFormats: IMG,
    maxFileBytes: 6 * MB,
    safeZone: { topPx: 510, rightPx: 510, bottomPx: 510, leftPx: 510 },
  }),
  fmt({
    id: "yt-thumbnail",
    label: "YouTube video thumbnail",
    network: "youtube",
    networkLabel: "YouTube",
    category: "thumbnail",
    medium: "image",
    widthPx: 1280,
    heightPx: 720,
    maxFileBytes: 2 * MB,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "yt-shorts",
    label: "YouTube Shorts video",
    network: "youtube",
    networkLabel: "YouTube",
    category: "reel",
    medium: "video",
    widthPx: 1080,
    heightPx: 1920,
    maxDurationSeconds: 60,
    recommendedFormats: VID,
  }),
  fmt({
    id: "yt-shorts-cover",
    label: "YouTube Shorts cover",
    network: "youtube",
    networkLabel: "YouTube",
    category: "thumbnail",
    medium: "image",
    widthPx: 1080,
    heightPx: 1920,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "yt-endscreen",
    label: "YouTube end-screen template",
    network: "youtube",
    networkLabel: "YouTube",
    category: "endscreen",
    medium: "image",
    widthPx: 1920,
    heightPx: 1080,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "yt-watermark",
    label: "YouTube channel watermark",
    network: "youtube",
    networkLabel: "YouTube",
    category: "watermark",
    medium: "image",
    widthPx: 150,
    heightPx: 150,
    maxFileBytes: 1 * MB,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "yt-video-1080p",
    label: "YouTube video (1080p)",
    network: "youtube",
    networkLabel: "YouTube",
    category: "post",
    medium: "video",
    widthPx: 1920,
    heightPx: 1080,
    recommendedFormats: VID,
  }),
  fmt({
    id: "yt-video-4k",
    label: "YouTube video (4K)",
    network: "youtube",
    networkLabel: "YouTube",
    category: "post",
    medium: "video",
    widthPx: 3840,
    heightPx: 2160,
    recommendedFormats: VID,
  }),
];

/* -------------------------------------------------------------------------- */
/*                                  TikTok                                    */
/* -------------------------------------------------------------------------- */

const tiktok: ContentAssetFormat[] = [
  fmt({
    id: "tt-profile-picture",
    label: "TikTok profile picture",
    network: "tiktok",
    networkLabel: "TikTok",
    category: "profile_picture",
    medium: "image",
    widthPx: 200,
    heightPx: 200,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "tt-video-vertical",
    label: "TikTok video (vertical)",
    network: "tiktok",
    networkLabel: "TikTok",
    category: "post",
    medium: "video",
    widthPx: 1080,
    heightPx: 1920,
    maxDurationSeconds: 600,
    recommendedFormats: VID,
    safeZone: { topPx: 130, rightPx: 140, bottomPx: 484, leftPx: 0 },
  }),
  fmt({
    id: "tt-photo-mode",
    label: "TikTok Photo Mode card",
    network: "tiktok",
    networkLabel: "TikTok",
    category: "post",
    medium: "image",
    widthPx: 1080,
    heightPx: 1920,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "tt-spark-ad",
    label: "TikTok Spark / in-feed ad",
    network: "tiktok",
    networkLabel: "TikTok",
    category: "ad",
    medium: "video",
    widthPx: 1080,
    heightPx: 1920,
    maxDurationSeconds: 60,
    recommendedFormats: VID,
  }),
  fmt({
    id: "tt-topview",
    label: "TikTok TopView ad",
    network: "tiktok",
    networkLabel: "TikTok",
    category: "ad",
    medium: "video",
    widthPx: 1080,
    heightPx: 1920,
    maxDurationSeconds: 60,
    recommendedFormats: VID,
  }),
  fmt({
    id: "tt-cover",
    label: "TikTok video cover",
    network: "tiktok",
    networkLabel: "TikTok",
    category: "thumbnail",
    medium: "image",
    widthPx: 1080,
    heightPx: 1920,
    recommendedFormats: IMG,
  }),
];

/* -------------------------------------------------------------------------- */
/*                                  Pinterest                                 */
/* -------------------------------------------------------------------------- */

const pinterest: ContentAssetFormat[] = [
  fmt({
    id: "pin-profile-picture",
    label: "Pinterest profile picture",
    network: "pinterest",
    networkLabel: "Pinterest",
    category: "profile_picture",
    medium: "image",
    widthPx: 165,
    heightPx: 165,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "pin-standard",
    label: "Pinterest standard pin (2:3)",
    network: "pinterest",
    networkLabel: "Pinterest",
    category: "pin",
    medium: "image",
    widthPx: 1000,
    heightPx: 1500,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "pin-square",
    label: "Pinterest square pin",
    network: "pinterest",
    networkLabel: "Pinterest",
    category: "pin",
    medium: "image",
    widthPx: 1000,
    heightPx: 1000,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "pin-long",
    label: "Pinterest long pin",
    network: "pinterest",
    networkLabel: "Pinterest",
    category: "pin",
    medium: "image",
    widthPx: 1000,
    heightPx: 2100,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "pin-idea",
    label: "Pinterest Idea / Story pin",
    network: "pinterest",
    networkLabel: "Pinterest",
    category: "story",
    medium: "image",
    widthPx: 1080,
    heightPx: 1920,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "pin-video",
    label: "Pinterest video pin",
    network: "pinterest",
    networkLabel: "Pinterest",
    category: "pin",
    medium: "video",
    widthPx: 1080,
    heightPx: 1920,
    maxDurationSeconds: 60,
    recommendedFormats: VID,
  }),
  fmt({
    id: "pin-board-cover",
    label: "Pinterest board cover",
    network: "pinterest",
    networkLabel: "Pinterest",
    category: "cover_photo",
    medium: "image",
    widthPx: 222,
    heightPx: 150,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "pin-product-shopping",
    label: "Pinterest product / shopping pin",
    network: "pinterest",
    networkLabel: "Pinterest",
    category: "ad",
    medium: "image",
    widthPx: 1000,
    heightPx: 1500,
    recommendedFormats: IMG,
  }),
];

/* -------------------------------------------------------------------------- */
/*                                  Snapchat                                  */
/* -------------------------------------------------------------------------- */

const snapchat: ContentAssetFormat[] = [
  fmt({
    id: "snap-profile-picture",
    label: "Snapchat profile (Bitmoji area)",
    network: "snapchat",
    networkLabel: "Snapchat",
    category: "profile_picture",
    medium: "image",
    widthPx: 320,
    heightPx: 320,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "snap-snap-ad",
    label: "Snapchat snap ad",
    network: "snapchat",
    networkLabel: "Snapchat",
    category: "ad",
    medium: "video",
    widthPx: 1080,
    heightPx: 1920,
    maxDurationSeconds: 180,
    recommendedFormats: VID,
  }),
  fmt({
    id: "snap-collection-ad",
    label: "Snapchat collection ad hero",
    network: "snapchat",
    networkLabel: "Snapchat",
    category: "ad",
    medium: "image",
    widthPx: 1080,
    heightPx: 1920,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "snap-story",
    label: "Snapchat story ad",
    network: "snapchat",
    networkLabel: "Snapchat",
    category: "story",
    medium: "image",
    widthPx: 1080,
    heightPx: 1920,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "snap-filter",
    label: "Snapchat geofilter",
    network: "snapchat",
    networkLabel: "Snapchat",
    category: "generic",
    medium: "image",
    widthPx: 1080,
    heightPx: 1920,
    recommendedFormats: ["png"],
  }),
];

/* -------------------------------------------------------------------------- */
/*                                  Reddit                                    */
/* -------------------------------------------------------------------------- */

const reddit: ContentAssetFormat[] = [
  fmt({
    id: "rd-profile-picture",
    label: "Reddit profile picture",
    network: "reddit",
    networkLabel: "Reddit",
    category: "profile_picture",
    medium: "image",
    widthPx: 256,
    heightPx: 256,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "rd-profile-banner",
    label: "Reddit profile banner",
    network: "reddit",
    networkLabel: "Reddit",
    category: "header_banner",
    medium: "image",
    widthPx: 1280,
    heightPx: 384,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "rd-subreddit-banner",
    label: "Subreddit banner",
    network: "reddit",
    networkLabel: "Reddit",
    category: "header_banner",
    medium: "image",
    widthPx: 1920,
    heightPx: 384,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "rd-post-image",
    label: "Reddit post image",
    network: "reddit",
    networkLabel: "Reddit",
    category: "post",
    medium: "image",
    widthPx: 1200,
    heightPx: 630,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "rd-post-square",
    label: "Reddit post image (square)",
    network: "reddit",
    networkLabel: "Reddit",
    category: "post",
    medium: "image",
    widthPx: 1080,
    heightPx: 1080,
    recommendedFormats: IMG,
  }),
];

/* -------------------------------------------------------------------------- */
/*                                  Threads                                   */
/* -------------------------------------------------------------------------- */

const threads: ContentAssetFormat[] = [
  fmt({
    id: "th-profile-picture",
    label: "Threads profile picture",
    network: "threads",
    networkLabel: "Threads",
    category: "profile_picture",
    medium: "image",
    widthPx: 320,
    heightPx: 320,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "th-post-square",
    label: "Threads post image (square)",
    network: "threads",
    networkLabel: "Threads",
    category: "post",
    medium: "image",
    widthPx: 1080,
    heightPx: 1080,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "th-post-portrait",
    label: "Threads post image (4:5)",
    network: "threads",
    networkLabel: "Threads",
    category: "post",
    medium: "image",
    widthPx: 1080,
    heightPx: 1350,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "th-video",
    label: "Threads video",
    network: "threads",
    networkLabel: "Threads",
    category: "post",
    medium: "video",
    widthPx: 1080,
    heightPx: 1920,
    maxDurationSeconds: 300,
    recommendedFormats: VID,
  }),
];

/* -------------------------------------------------------------------------- */
/*                                  Discord                                   */
/* -------------------------------------------------------------------------- */

const discord: ContentAssetFormat[] = [
  fmt({
    id: "dc-server-icon",
    label: "Discord server icon",
    network: "discord",
    networkLabel: "Discord",
    category: "icon",
    medium: "image",
    widthPx: 512,
    heightPx: 512,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "dc-server-banner",
    label: "Discord server banner",
    network: "discord",
    networkLabel: "Discord",
    category: "header_banner",
    medium: "image",
    widthPx: 960,
    heightPx: 540,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "dc-profile-banner",
    label: "Discord profile banner",
    network: "discord",
    networkLabel: "Discord",
    category: "header_banner",
    medium: "image",
    widthPx: 600,
    heightPx: 240,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "dc-emoji",
    label: "Discord custom emoji",
    network: "discord",
    networkLabel: "Discord",
    category: "icon",
    medium: "image",
    widthPx: 128,
    heightPx: 128,
    maxFileBytes: 256 * 1024,
    recommendedFormats: ["png"],
  }),
  fmt({
    id: "dc-sticker",
    label: "Discord sticker",
    network: "discord",
    networkLabel: "Discord",
    category: "icon",
    medium: "image",
    widthPx: 320,
    heightPx: 320,
    recommendedFormats: ["png"],
  }),
];

/* -------------------------------------------------------------------------- */
/*                                  Twitch                                    */
/* -------------------------------------------------------------------------- */

const twitch: ContentAssetFormat[] = [
  fmt({
    id: "tw-profile-picture",
    label: "Twitch profile picture",
    network: "twitch",
    networkLabel: "Twitch",
    category: "profile_picture",
    medium: "image",
    widthPx: 256,
    heightPx: 256,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "tw-profile-banner",
    label: "Twitch profile banner",
    network: "twitch",
    networkLabel: "Twitch",
    category: "header_banner",
    medium: "image",
    widthPx: 1200,
    heightPx: 480,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "tw-offline-banner",
    label: "Twitch offline banner",
    network: "twitch",
    networkLabel: "Twitch",
    category: "header_banner",
    medium: "image",
    widthPx: 1920,
    heightPx: 1080,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "tw-panel",
    label: "Twitch info panel",
    network: "twitch",
    networkLabel: "Twitch",
    category: "panel",
    medium: "image",
    widthPx: 320,
    heightPx: 100,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "tw-thumbnail",
    label: "Twitch video thumbnail",
    network: "twitch",
    networkLabel: "Twitch",
    category: "thumbnail",
    medium: "image",
    widthPx: 1280,
    heightPx: 720,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "tw-overlay",
    label: "Twitch stream overlay (1080p)",
    network: "twitch",
    networkLabel: "Twitch",
    category: "generic",
    medium: "image",
    widthPx: 1920,
    heightPx: 1080,
    recommendedFormats: ["png"],
  }),
];

/* -------------------------------------------------------------------------- */
/*                                  Email                                     */
/* -------------------------------------------------------------------------- */

const email: ContentAssetFormat[] = [
  fmt({
    id: "em-header",
    label: "Email header",
    network: "email",
    networkLabel: "Email",
    category: "email_graphic",
    medium: "image",
    widthPx: 600,
    heightPx: 200,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "em-banner",
    label: "Email banner",
    network: "email",
    networkLabel: "Email",
    category: "email_graphic",
    medium: "image",
    widthPx: 600,
    heightPx: 400,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "em-footer",
    label: "Email footer",
    network: "email",
    networkLabel: "Email",
    category: "email_graphic",
    medium: "image",
    widthPx: 600,
    heightPx: 200,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "em-newsletter-hero",
    label: "Newsletter hero",
    network: "email",
    networkLabel: "Email",
    category: "email_graphic",
    medium: "image",
    widthPx: 1200,
    heightPx: 600,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "em-product-card",
    label: "Email product card",
    network: "email",
    networkLabel: "Email",
    category: "email_graphic",
    medium: "image",
    widthPx: 600,
    heightPx: 600,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "em-signature",
    label: "Email signature graphic",
    network: "email",
    networkLabel: "Email",
    category: "email_graphic",
    medium: "image",
    widthPx: 600,
    heightPx: 150,
    recommendedFormats: IMG,
  }),
];

/* -------------------------------------------------------------------------- */
/*                                  Web / Display                             */
/* -------------------------------------------------------------------------- */

const web: ContentAssetFormat[] = [
  fmt({
    id: "web-blog-hero",
    label: "Blog hero image (16:9)",
    network: "web",
    networkLabel: "Web",
    category: "header_banner",
    medium: "image",
    widthPx: 1920,
    heightPx: 1080,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "web-featured-image",
    label: "Web featured image (1.78:1)",
    network: "web",
    networkLabel: "Web",
    category: "post",
    medium: "image",
    widthPx: 1200,
    heightPx: 675,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "web-leaderboard",
    label: "IAB leaderboard ad",
    network: "web",
    networkLabel: "Web",
    category: "web_banner",
    medium: "image",
    widthPx: 728,
    heightPx: 90,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "web-mobile-leaderboard",
    label: "IAB mobile leaderboard",
    network: "web",
    networkLabel: "Web",
    category: "web_banner",
    medium: "image",
    widthPx: 320,
    heightPx: 50,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "web-medium-rectangle",
    label: "IAB medium rectangle",
    network: "web",
    networkLabel: "Web",
    category: "web_banner",
    medium: "image",
    widthPx: 300,
    heightPx: 250,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "web-large-rectangle",
    label: "IAB large rectangle",
    network: "web",
    networkLabel: "Web",
    category: "web_banner",
    medium: "image",
    widthPx: 336,
    heightPx: 280,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "web-skyscraper",
    label: "IAB wide skyscraper",
    network: "web",
    networkLabel: "Web",
    category: "web_banner",
    medium: "image",
    widthPx: 160,
    heightPx: 600,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "web-half-page",
    label: "IAB half page ad",
    network: "web",
    networkLabel: "Web",
    category: "web_banner",
    medium: "image",
    widthPx: 300,
    heightPx: 600,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "web-billboard",
    label: "IAB billboard",
    network: "web",
    networkLabel: "Web",
    category: "web_banner",
    medium: "image",
    widthPx: 970,
    heightPx: 250,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "web-favicon",
    label: "Favicon",
    network: "web",
    networkLabel: "Web",
    category: "icon",
    medium: "image",
    widthPx: 512,
    heightPx: 512,
    recommendedFormats: ["png"],
  }),
  fmt({
    id: "web-app-icon",
    label: "App icon (1024)",
    network: "web",
    networkLabel: "Web",
    category: "icon",
    medium: "image",
    widthPx: 1024,
    heightPx: 1024,
    recommendedFormats: ["png"],
  }),
  fmt({
    id: "web-og-image",
    label: "Open Graph share image (1.91:1)",
    network: "web",
    networkLabel: "Web",
    category: "thumbnail",
    medium: "image",
    widthPx: 1200,
    heightPx: 630,
    recommendedFormats: IMG,
  }),
];

/* -------------------------------------------------------------------------- */
/*                                  Print                                     */
/* -------------------------------------------------------------------------- */

const print: ContentAssetFormat[] = [
  fmt({
    id: "pr-business-card-us",
    label: "Business card (US, 3.5×2 in @ 300dpi)",
    network: "print",
    networkLabel: "Print",
    category: "print",
    medium: "image",
    widthPx: 1050,
    heightPx: 600,
    recommendedFormats: PRINT,
  }),
  fmt({
    id: "pr-postcard-4x6",
    label: "Postcard 4×6 in",
    network: "print",
    networkLabel: "Print",
    category: "print",
    medium: "image",
    widthPx: 1875,
    heightPx: 1275,
    recommendedFormats: PRINT,
  }),
  fmt({
    id: "pr-flyer-letter",
    label: "Flyer (US Letter)",
    network: "print",
    networkLabel: "Print",
    category: "print",
    medium: "image",
    widthPx: 2550,
    heightPx: 3300,
    recommendedFormats: PRINT,
  }),
  fmt({
    id: "pr-flyer-a4",
    label: "Flyer (A4)",
    network: "print",
    networkLabel: "Print",
    category: "print",
    medium: "image",
    widthPx: 2480,
    heightPx: 3508,
    recommendedFormats: PRINT,
  }),
  fmt({
    id: "pr-poster-tabloid",
    label: "Poster (Tabloid 11×17)",
    network: "print",
    networkLabel: "Print",
    category: "print",
    medium: "image",
    widthPx: 3300,
    heightPx: 5100,
    recommendedFormats: PRINT,
  }),
  fmt({
    id: "pr-square-flyer",
    label: "Square flyer (5×5)",
    network: "print",
    networkLabel: "Print",
    category: "print",
    medium: "image",
    widthPx: 1500,
    heightPx: 1500,
    recommendedFormats: PRINT,
  }),
];

/* -------------------------------------------------------------------------- */
/*                                  Podcast                                   */
/* -------------------------------------------------------------------------- */

const podcast: ContentAssetFormat[] = [
  fmt({
    id: "pod-cover",
    label: "Podcast cover art",
    description:
      "Apple Podcasts and Spotify both require RGB colorspace; 3000×3000 is the upload max.",
    network: "podcast",
    networkLabel: "Podcast",
    category: "podcast_cover",
    medium: "image",
    widthPx: 3000,
    heightPx: 3000,
    maxFileBytes: 500 * 1024,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "pod-episode-art",
    label: "Podcast episode art",
    network: "podcast",
    networkLabel: "Podcast",
    category: "podcast_cover",
    medium: "image",
    widthPx: 1400,
    heightPx: 1400,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "pod-quote-card",
    label: "Podcast quote card (square)",
    network: "podcast",
    networkLabel: "Podcast",
    category: "post",
    medium: "image",
    widthPx: 1080,
    heightPx: 1080,
    recommendedFormats: IMG,
  }),
];

/* -------------------------------------------------------------------------- */
/*                                  Generic                                   */
/* -------------------------------------------------------------------------- */

const generic: ContentAssetFormat[] = [
  fmt({
    id: "g-square-1080",
    label: "Square 1:1 (1080)",
    network: "generic",
    networkLabel: "Generic",
    category: "generic",
    medium: "image",
    widthPx: 1080,
    heightPx: 1080,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "g-portrait-4-5",
    label: "Portrait 4:5 (1080)",
    network: "generic",
    networkLabel: "Generic",
    category: "generic",
    medium: "image",
    widthPx: 1080,
    heightPx: 1350,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "g-vertical-9-16",
    label: "Vertical 9:16 (1080)",
    network: "generic",
    networkLabel: "Generic",
    category: "generic",
    medium: "image",
    widthPx: 1080,
    heightPx: 1920,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "g-landscape-16-9-1080",
    label: "Landscape 16:9 (1080p)",
    network: "generic",
    networkLabel: "Generic",
    category: "generic",
    medium: "image",
    widthPx: 1920,
    heightPx: 1080,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "g-landscape-16-9-4k",
    label: "Landscape 16:9 (4K)",
    network: "generic",
    networkLabel: "Generic",
    category: "generic",
    medium: "image",
    widthPx: 3840,
    heightPx: 2160,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "g-presentation-16-9",
    label: "Presentation slide 16:9",
    network: "generic",
    networkLabel: "Generic",
    category: "presentation",
    medium: "image",
    widthPx: 1920,
    heightPx: 1080,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "g-presentation-4-3",
    label: "Presentation slide 4:3",
    network: "generic",
    networkLabel: "Generic",
    category: "presentation",
    medium: "image",
    widthPx: 1024,
    heightPx: 768,
    recommendedFormats: IMG,
  }),
  fmt({
    id: "g-cinematic-21-9",
    label: "Cinematic ultra-wide 21:9",
    network: "generic",
    networkLabel: "Generic",
    category: "generic",
    medium: "image",
    widthPx: 2560,
    heightPx: 1080,
    recommendedFormats: IMG,
  }),
];

/* -------------------------------------------------------------------------- */
/*                              Final catalog                                 */
/* -------------------------------------------------------------------------- */

const RAW_CATALOG: ContentAssetFormat[] = [
  ...facebook,
  ...instagram,
  ...x,
  ...linkedin,
  ...youtube,
  ...tiktok,
  ...pinterest,
  ...snapchat,
  ...reddit,
  ...threads,
  ...discord,
  ...twitch,
  ...email,
  ...web,
  ...print,
  ...podcast,
  ...generic,
];

/** Frozen catalog of all asset formats. */
export const CONTENT_ASSET_CATALOG: ReadonlyArray<ContentAssetFormat> =
  Object.freeze(RAW_CATALOG.slice());

export const CONTENT_ASSET_COUNT = CONTENT_ASSET_CATALOG.length;

/** Sorted list of every distinct network present in the catalog. */
export const CONTENT_ASSET_NETWORKS: ReadonlyArray<ContentAssetNetwork> =
  Object.freeze(
    Array.from(
      new Set(CONTENT_ASSET_CATALOG.map((f) => f.network)),
    ).sort() as ContentAssetNetwork[],
  );

/** Sorted list of every distinct category present in the catalog. */
export const CONTENT_ASSET_CATEGORIES: ReadonlyArray<ContentAssetCategory> =
  Object.freeze(
    Array.from(
      new Set(CONTENT_ASSET_CATALOG.map((f) => f.category)),
    ).sort() as ContentAssetCategory[],
  );

/** Stable id → format lookup, computed once at module load. */
const BY_ID = new Map<string, ContentAssetFormat>(
  CONTENT_ASSET_CATALOG.map((f) => [f.id, f] as const),
);

export function findAssetFormatById(
  id: string,
): ContentAssetFormat | undefined {
  return BY_ID.get(id);
}

export function getAssetFormatsByNetwork(
  network: ContentAssetNetwork,
): ContentAssetFormat[] {
  return CONTENT_ASSET_CATALOG.filter((f) => f.network === network);
}

export function getAssetFormatsByCategory(
  category: ContentAssetCategory,
): ContentAssetFormat[] {
  return CONTENT_ASSET_CATALOG.filter((f) => f.category === category);
}

export function getAssetFormatsByMedium(
  medium: ContentAssetMedium,
): ContentAssetFormat[] {
  return CONTENT_ASSET_CATALOG.filter((f) => f.medium === medium);
}

/**
 * Group every catalog entry by network — the typical UI shape for a Canva-like
 * "all formats" picker (sidebar = networks, body = formats).
 */
export function groupAssetFormatsByNetwork(): Record<
  ContentAssetNetwork,
  ContentAssetFormat[]
> {
  const out = {} as Record<ContentAssetNetwork, ContentAssetFormat[]>;
  for (const network of CONTENT_ASSET_NETWORKS) {
    out[network] = [];
  }
  for (const f of CONTENT_ASSET_CATALOG) {
    out[f.network].push(f);
  }
  return out;
}
