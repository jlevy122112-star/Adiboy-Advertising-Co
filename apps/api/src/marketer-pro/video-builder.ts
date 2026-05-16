/**
 * Build a video from a list of image URLs using FFmpeg.
 *
 * Formats:
 *   "shorts"     — 1080×1920 vertical (YouTube Shorts / Instagram Reels / TikTok)
 *   "square"     — 1080×1080 (Instagram feed)
 *   "widescreen" — 1920×1080 (YouTube standard)
 *
 * Each image gets a Ken Burns zoom/pan effect (slow alternating zoom in/out)
 * so the video feels cinematic rather than a static slideshow.
 * Crossfade transitions (0.5 s) are applied between images.
 *
 * ── Text overlays (burned in via drawtext) ──────────────────────────────────
 *   title     — large hook text in the upper third
 *   caption   — body text in the lower third
 *   hashtags  — hashtag string at the very bottom (purple)
 *   emoji     — large emoji centered on the video (requires emoji font on server)
 *
 * ── Stickers (PNG image overlays with optional opacity / positioning) ────────
 *   stickers  — array of { url, x?, y?, width?, opacity? }
 *   Positions use FFmpeg overlay expressions: W/H = canvas, w/h = sticker size.
 *   Examples:  x:"W-w-20" y:"20"  → top-right  |  x:"W/2-w/2" y:"H/2-h/2" → center
 *
 * ── Color filter presets ─────────────────────────────────────────────────────
 *   none / warm / cool / dramatic / faded / vivid / bw
 *   Plus manual brightness, contrast, saturation, vignette overrides.
 *
 * ── Effects ──────────────────────────────────────────────────────────────────
 *   fade_in   — fade from black at the first 0.5 s
 *   fade_out  — fade to black at the last 0.5 s
 *   grain     — subtle film grain texture
 *   sharpen   — unsharp mask (crispier frames)
 *   glow      — dreamy soft-glow bloom
 *
 * Total duration = imageUrls.length × secondsPerImage (≤60 s enforced for Shorts).
 * Requires FFmpeg on PATH (install: winget install ffmpeg).
 */

import ffmpeg from "fluent-ffmpeg";
import { createWriteStream, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

export type VideoFormat = "shorts" | "square" | "widescreen";

// ── Filter preset ─────────────────────────────────────────────────────────────

export type VideoFilterPreset =
  | "none"
  | "warm"
  | "cool"
  | "dramatic"
  | "faded"
  | "vivid"
  | "bw";

export type VideoFilters = {
  /** Color grade preset. Default: "none" */
  preset?: VideoFilterPreset;
  /** Brightness offset: -1.0 (black) to 1.0 (white). Default: 0 */
  brightness?: number;
  /** Contrast multiplier: 0 (flat) to 2.0 (max). Default: 1 */
  contrast?: number;
  /** Saturation multiplier: 0 (grayscale) to 3.0 (vivid). Default: 1 */
  saturation?: number;
  /** Soft darkened-edge vignette. Default: false */
  vignette?: boolean;
};

// ── Effects ───────────────────────────────────────────────────────────────────

export type VideoEffect = "fade_in" | "fade_out" | "grain" | "sharpen" | "glow";

// ── Stickers ──────────────────────────────────────────────────────────────────

export type VideoSticker = {
  /** URL of a PNG image (transparency supported). */
  url: string;
  /**
   * Horizontal position as an FFmpeg overlay expression.
   * W = canvas width, w = sticker width. Default: "W-w-20" (right edge, 20 px inset).
   */
  x?: string;
  /**
   * Vertical position as an FFmpeg overlay expression.
   * H = canvas height, h = sticker height. Default: "20" (near top).
   */
  y?: string;
  /** Scale the sticker to this pixel width (height auto-scales). Default: 200 */
  width?: number;
  /** Opacity 0.0–1.0. Default: 1.0 */
  opacity?: number;
};

// ── Text overlays ─────────────────────────────────────────────────────────────

export type VideoTextOverlays = {
  /** Large hook text in the upper third. Ideal for the post headline. */
  title?: string;
  /** Body text in the lower third. */
  caption?: string;
  /** Hashtag string at the very bottom (e.g. "#marketing #ai"), rendered in purple. */
  hashtags?: string;
  /**
   * Emoji character(s) displayed large in the center of the frame
   * (e.g. "🔥✨"). Rendering quality depends on the emoji font installed
   * on the server (Segoe UI Emoji on Windows, Noto Color Emoji on Linux).
   */
  emoji?: string;
};

// ── Options ───────────────────────────────────────────────────────────────────

export type BuildVideoOptions = {
  /** Publicly accessible image URLs (1–10). */
  imageUrls: string[];
  /** Seconds each image is shown. Default: 4 */
  secondsPerImage?: number;
  /** Output format. Default: "shorts" (1080×1920 vertical). */
  format?: VideoFormat;
  /** Optional text + emoji overlays burned into the video. */
  text?: VideoTextOverlays;
  /** Optional color filter / grade. */
  filters?: VideoFilters;
  /**
   * PNG image overlays composited on top of the video (stickers, logos, emoji PNGs).
   * Up to 5 stickers supported.
   */
  stickers?: VideoSticker[];
  /**
   * Visual effects applied to the final video.
   * Multiple effects can be combined.
   */
  effects?: VideoEffect[];
};

export type BuildVideoResult =
  | { ok: true; outputPath: string }
  | { ok: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────

const RESOLUTION: Record<VideoFormat, { w: number; h: number }> = {
  shorts: { w: 1080, h: 1920 },
  square: { w: 1080, h: 1080 },
  widescreen: { w: 1920, h: 1080 },
};

// Ken Burns: alternate zoom-in / zoom-out per image
function kenBurnsFilter(index: number, w: number, h: number, durationSecs: number): string {
  const frames = Math.round(durationSecs * 25);
  const zoomIn = index % 2 === 0;
  if (zoomIn) {
    return (
      `zoompan=z='min(zoom+0.0005,1.15)':` +
      `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':` +
      `d=${frames}:s=${w}x${h}:fps=25`
    );
  }
  return (
    `zoompan=z='if(lte(zoom,1.0),1.15,max(1.0,zoom-0.0005))':` +
    `x='iw/2-(iw/zoom/2)+10':y='ih/2-(ih/zoom/2)':` +
    `d=${frames}:s=${w}x${h}:fps=25`
  );
}

function sanitizeText(t: string): string {
  // Escape characters that break FFmpeg drawtext; preserve emoji codepoints
  return t.replace(/[:'\\[\]]/g, " ").replace(/\n/g, " ").trim();
}

// ── Color filter ──────────────────────────────────────────────────────────────

function buildColorFilterEntry(
  inputLabel: string,
  vf: VideoFilters,
): { entry: string | null; outputLabel: string } {
  const preset = vf.preset ?? "none";
  const parts: string[] = [];

  let b = vf.brightness ?? 0;
  let c = vf.contrast ?? 1;
  let s = vf.saturation ?? 1;

  switch (preset) {
    case "warm":
      s = Math.min(3, s * 1.15);
      c = Math.min(2, c * 1.05);
      break;
    case "cool":
      s = Math.max(0, s * 0.9);
      break;
    case "dramatic":
      c = Math.min(2, c * 1.4);
      s = Math.max(0, s * 0.7);
      break;
    case "faded":
      c = Math.max(0, c * 0.75);
      b = Math.min(1, b + 0.05);
      s = Math.max(0, s * 0.85);
      break;
    case "vivid":
      s = Math.min(3, s * 1.5);
      c = Math.min(2, c * 1.1);
      break;
    case "bw":
      s = 0;
      break;
  }

  if (Math.abs(b) > 0.001 || Math.abs(c - 1) > 0.001 || Math.abs(s - 1) > 0.001) {
    parts.push(`eq=brightness=${b.toFixed(3)}:contrast=${c.toFixed(3)}:saturation=${s.toFixed(3)}`);
  }

  if (preset === "warm") {
    parts.push("colorbalance=rs=0.08:gs=0:bs=-0.08:rm=0.04:gm=0:bm=-0.04");
  } else if (preset === "cool") {
    parts.push("colorbalance=rs=-0.08:gs=0:bs=0.12:rm=-0.04:gm=0:bm=0.06");
  }

  if (vf.vignette) {
    parts.push("vignette=angle=PI/4");
  }

  if (parts.length === 0) {
    return { entry: null, outputLabel: inputLabel };
  }

  const outputLabel = "color_graded";
  return { entry: `[${inputLabel}]${parts.join(",")}[${outputLabel}]`, outputLabel };
}

// ── Effects ───────────────────────────────────────────────────────────────────

function buildPreTextEffects(
  inputLabel: string,
  effects: VideoEffect[],
): { entries: string[]; outputLabel: string } {
  const entries: string[] = [];
  let label = inputLabel;

  if (effects.includes("grain")) {
    const next = "grain_fx";
    entries.push(`[${label}]noise=alls=15:allf=t+u[${next}]`);
    label = next;
  }

  if (effects.includes("sharpen")) {
    const next = "sharp_fx";
    entries.push(`[${label}]unsharp=5:5:1.0:5:5:0.0[${next}]`);
    label = next;
  }

  if (effects.includes("glow")) {
    const base = "glow_base";
    const blurred = "glow_blur";
    const next = "glow_fx";
    entries.push(`[${label}]split=2[${base}][glow_in]`);
    entries.push(`[glow_in]boxblur=10[${blurred}]`);
    entries.push(`[${base}][${blurred}]blend=all_mode=screen:all_opacity=0.4[${next}]`);
    label = next;
  }

  return { entries, outputLabel: label };
}

function buildFadeEffects(
  inputLabel: string,
  effects: VideoEffect[],
  totalDuration: number,
): { entry: string | null; outputLabel: string } {
  const fadeParts: string[] = [];

  if (effects.includes("fade_in")) {
    fadeParts.push("fade=t=in:st=0:d=0.5");
  }
  if (effects.includes("fade_out")) {
    fadeParts.push(`fade=t=out:st=${(totalDuration - 0.5).toFixed(2)}:d=0.5`);
  }

  if (fadeParts.length === 0) {
    return { entry: null, outputLabel: inputLabel };
  }

  const outputLabel = "faded";
  return {
    entry: `[${inputLabel}]${fadeParts.join(",")}[${outputLabel}]`,
    outputLabel,
  };
}

// ── Sticker overlays ──────────────────────────────────────────────────────────

function buildStickerEntries(
  inputLabel: string,
  stickers: VideoSticker[],
  imageCount: number,
): { entries: string[]; outputLabel: string } {
  const entries: string[] = [];
  let label = inputLabel;

  for (let i = 0; i < stickers.length; i++) {
    const st = stickers[i]!;
    const stickerInputIdx = imageCount + i;
    const width = st.width ?? 200;
    const opacity = Math.min(1, Math.max(0, st.opacity ?? 1));
    const x = st.x ?? "W-w-20";
    const y = st.y ?? "20";

    const scaled = `st_scaled_${i}`;
    const next = `with_st_${i}`;

    entries.push(`[${stickerInputIdx}:v]scale=${width}:-1,format=rgba[${scaled}]`);

    if (opacity < 0.999) {
      const ready = `st_ready_${i}`;
      entries.push(`[${scaled}]colorchannelmixer=aa=${opacity.toFixed(3)}[${ready}]`);
      entries.push(`[${label}][${ready}]overlay=x=${x}:y=${y}[${next}]`);
    } else {
      entries.push(`[${label}][${scaled}]overlay=x=${x}:y=${y}[${next}]`);
    }

    label = next;
  }

  return { entries, outputLabel: label };
}

// ── Text overlays ─────────────────────────────────────────────────────────────

function getEmojiFontOption(): string {
  if (process.platform === "win32") {
    return ":fontfile='C\\\\\\\\:/Windows/Fonts/seguiemj.ttf'";
  }
  return ":fontfile='/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf'";
}

function buildTextEntries(
  inputLabel: string,
  text: VideoTextOverlays,
  format: VideoFormat,
): { entries: string[]; outputLabel: string } {
  const entries: string[] = [];
  let label = inputLabel;
  const isShorts = format === "shorts";
  const titleSize = isShorts ? 64 : 52;
  const captionSize = isShorts ? 52 : 44;
  const hashtagSize = isShorts ? 38 : 32;
  const emojiSize = isShorts ? 180 : 140;

  if (text.title?.trim()) {
    const safe = sanitizeText(text.title).slice(0, 80);
    const next = "title_ov";
    entries.push(
      `[${label}]drawtext=` +
      `text='${safe}':fontsize=${titleSize}:fontcolor=white:` +
      `x=(w-text_w)/2:y=80:` +
      `box=1:boxcolor=black@0.6:boxborderw=14[${next}]`,
    );
    label = next;
  }

  if (text.emoji?.trim()) {
    const safe = sanitizeText(text.emoji).slice(0, 8);
    const next = "emoji_ov";
    entries.push(
      `[${label}]drawtext=` +
      `text='${safe}'${getEmojiFontOption()}:` +
      `fontsize=${emojiSize}:` +
      `x=(w-text_w)/2:y=(h-text_h)/2[${next}]`,
    );
    label = next;
  }

  if (text.caption?.trim()) {
    const safe = sanitizeText(text.caption).slice(0, 200);
    const yPos = text.hashtags?.trim() ? "h-th-140" : "h-th-60";
    const next = "caption_ov";
    entries.push(
      `[${label}]drawtext=` +
      `text='${safe}':fontsize=${captionSize}:fontcolor=white:` +
      `x=(w-text_w)/2:y=${yPos}:` +
      `box=1:boxcolor=black@0.55:boxborderw=12[${next}]`,
    );
    label = next;
  }

  if (text.hashtags?.trim()) {
    const safe = sanitizeText(text.hashtags).slice(0, 120);
    const next = "hashtag_ov";
    entries.push(
      `[${label}]drawtext=` +
      `text='${safe}':fontsize=${hashtagSize}:fontcolor=#a78bfa:` +
      `x=(w-text_w)/2:y=h-th-20:` +
      `box=1:boxcolor=black@0.45:boxborderw=8[${next}]`,
    );
    label = next;
  }

  return { entries, outputLabel: label };
}

// ── Download ──────────────────────────────────────────────────────────────────

async function downloadImage(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${res.status}: ${url}`);
  if (!res.body) throw new Error("Empty response body");
  const writer = createWriteStream(destPath);
  await pipeline(
    Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
    writer,
  );
}

// ── Main builder ──────────────────────────────────────────────────────────────

export async function buildSlideshowVideo(
  options: BuildVideoOptions,
): Promise<BuildVideoResult> {
  const {
    imageUrls,
    secondsPerImage = 4,
    format = "shorts",
    text = {},
    filters: videoFilters = {},
    stickers = [],
    effects = [],
  } = options;

  if (imageUrls.length === 0) {
    return { ok: false, error: "At least one image URL is required" };
  }
  if (imageUrls.length > 10) {
    return { ok: false, error: "Maximum 10 images per video" };
  }
  if (stickers.length > 5) {
    return { ok: false, error: "Maximum 5 stickers per video" };
  }

  const totalDuration = imageUrls.length * secondsPerImage;
  if (format === "shorts" && totalDuration > 60) {
    return {
      ok: false,
      error:
        `Shorts must be ≤60 s — ${imageUrls.length} images × ${secondsPerImage} s = ${totalDuration} s. ` +
        `Reduce secondsPerImage or image count.`,
    };
  }

  const { w, h } = RESOLUTION[format];
  const workDir = join(tmpdir(), `marketer-video-${Date.now()}`);
  mkdirSync(workDir, { recursive: true });

  try {
    // Download slide images
    const localPaths: string[] = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const ext = imageUrls[i]!.match(/\.(jpe?g|png|gif|webp)/i)?.[1] ?? "jpg";
      const dest = join(workDir, `img_${String(i).padStart(3, "0")}.${ext}`);
      await downloadImage(imageUrls[i]!, dest);
      localPaths.push(dest);
    }

    // Download sticker images
    const localStickerPaths: string[] = [];
    for (let i = 0; i < stickers.length; i++) {
      const ext = stickers[i]!.url.match(/\.(jpe?g|png|gif|webp)/i)?.[1] ?? "png";
      const dest = join(workDir, `sticker_${String(i).padStart(2, "0")}.${ext}`);
      await downloadImage(stickers[i]!.url, dest);
      localStickerPaths.push(dest);
    }

    const outputPath = join(workDir, "output.mp4");
    const fadeDuration = 0.5;
    const inputDuration = secondsPerImage + fadeDuration;

    await new Promise<void>((resolve, reject) => {
      let cmd = ffmpeg();

      // Slide image inputs (looped, duration = inputDuration each)
      for (const imgPath of localPaths) {
        cmd = cmd.input(imgPath).inputOptions(["-loop 1", `-t ${inputDuration}`]);
      }

      // Sticker inputs (single frame PNGs)
      for (const stickerPath of localStickerPaths) {
        cmd = cmd.input(stickerPath);
      }

      const filterGraph: string[] = [];

      // 1. Scale → crop to cover → Ken Burns per image
      for (let i = 0; i < localPaths.length; i++) {
        filterGraph.push(
          `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,` +
          `crop=${w}:${h},setsar=1,fps=25,` +
          kenBurnsFilter(i, w, h, inputDuration) +
          `[kb${i}]`,
        );
      }

      // 2. xfade chain
      let lastLabel: string;
      if (localPaths.length === 1) {
        lastLabel = "kb0";
      } else {
        let prevLabel = "kb0";
        for (let i = 1; i < localPaths.length; i++) {
          const offset = i * secondsPerImage - fadeDuration * i;
          const outLabel = i === localPaths.length - 1 ? "video_base" : `xf${i}`;
          filterGraph.push(
            `[${prevLabel}][kb${i}]xfade=transition=fade:duration=${fadeDuration}:offset=${offset}[${outLabel}]`,
          );
          prevLabel = outLabel;
        }
        lastLabel = "video_base";
      }

      // 3. Color filter / grade
      const { entry: colorEntry, outputLabel: colorLabel } = buildColorFilterEntry(
        lastLabel,
        videoFilters,
      );
      if (colorEntry) {
        filterGraph.push(colorEntry);
        lastLabel = colorLabel;
      }

      // 4. Pre-text effects (grain, sharpen, glow)
      if (effects.length > 0) {
        const { entries: fxEntries, outputLabel: fxLabel } = buildPreTextEffects(lastLabel, effects);
        filterGraph.push(...fxEntries);
        lastLabel = fxLabel;
      }

      // 5. Sticker overlays
      if (localStickerPaths.length > 0) {
        const { entries: stickerEntries, outputLabel: stickerLabel } = buildStickerEntries(
          lastLabel,
          stickers,
          localPaths.length,
        );
        filterGraph.push(...stickerEntries);
        lastLabel = stickerLabel;
      }

      // 6. Text + emoji overlays
      const { entries: textEntries, outputLabel: textLabel } = buildTextEntries(
        lastLabel,
        text,
        format,
      );
      filterGraph.push(...textEntries);
      lastLabel = textLabel;

      // 7. Fade in / fade out (applied last so fades cover all layers)
      const { entry: fadeEntry, outputLabel: fadeLabel } = buildFadeEffects(
        lastLabel,
        effects,
        totalDuration,
      );
      if (fadeEntry) {
        filterGraph.push(fadeEntry);
        lastLabel = fadeLabel;
      }

      cmd
        .complexFilter(filterGraph, lastLabel)
        .outputOptions([
          "-c:v libx264",
          "-preset fast",
          "-crf 23",
          "-pix_fmt yuv420p",
          "-movflags +faststart",
          "-an",
        ])
        .output(outputPath)
        .on("end", () => resolve())
        .on("error", (err: Error) => reject(err))
        .run();
    });

    return { ok: true, outputPath };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ok: false, error };
  }
}
