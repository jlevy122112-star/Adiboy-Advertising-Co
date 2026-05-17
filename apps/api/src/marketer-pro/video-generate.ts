/**
 * Phase 7 video generation — two-phase pipeline.
 *
 * startVideoGeneration() — fast path (HTTP):
 *   Generates script via OpenAI, moderates, inserts DB rows with status="queued",
 *   enqueues a BullMQ VideoRenderJob, and returns immediately.
 *
 * executeVideoRender() — slow path (BullMQ worker):
 *   Loads script from DB, generates DALL-E scene images, optional TTS voiceover,
 *   renders MP4, extracts thumbnail, uploads both to S3, updates DB rows.
 *
 * Env: MARKETER_OPENAI_API_KEY / OPENAI_API_KEY, AWS_*
 */

import { randomUUID } from "node:crypto";
import type { GenerationBrief } from "@home-link/marketer-pro-contract";
import { networkToVideoPlatform, getVideoDimensions } from "@home-link/marketer-pro-contract";
import type { Queue } from "bullmq";
import type { VideoRenderJobPayload } from "@home-link/marketer-pro-queue";
import { enqueueVideoRenderJob } from "@home-link/marketer-pro-queue";
import { generateVideoScript } from "./openai-video-script.js";
import { generateImageWithDalle } from "./openai-image-gen.js";
import { generateVoiceover } from "./openai-tts.js";
import { moderateText } from "./openai-moderation.js";
import { renderVideoSlideshow, extractThumbnail } from "./video-render.js";
import { uploadBufferToS3, isS3Configured } from "../storage/s3.js";
import { getWorkspaceBranding } from "../db/workspace-branding.js";
import {
  insertVideoScript,
  updateVideoScript,
  insertVideoRenderJob,
  updateVideoRenderJob,
  getVideoScript,
  type VideoScriptRow,
  type VideoRenderJobRow,
} from "../db/video-script.js";

export type VideoStartInput = {
  tenantId: string;
  brief: GenerationBrief;
  network?: string | null;
  voiceover?: boolean;
  scheduleEntryId?: string | null;
  queue: Queue<VideoRenderJobPayload>;
};

export type VideoStartResult =
  | { ok: true; scriptId: string; jobId: string; status: "queued" }
  | { ok: false; error: string };

export type VideoRenderInput = {
  tenantId: string;
  scriptId: string;
  jobId: string;
  voiceover?: boolean;
};

export type VideoRenderResult =
  | { ok: true; url: string; thumbnailUrl: string | null; durationS: number }
  | { ok: false; error: string };

// Legacy compat shape — kept so existing test mocks still compile.
export type VideoGenerateResult =
  | { ok: true; script: VideoScriptRow; job: VideoRenderJobRow }
  | { ok: false; error: string; script?: VideoScriptRow };

function openAiKey(): string | undefined {
  return (
    process.env.MARKETER_OPENAI_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    undefined
  );
}

async function fetchLogoBuffer(logoUrl: string): Promise<Buffer | undefined> {
  try {
    const res = await fetch(logoUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return undefined;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return undefined;
  }
}

/** Fast path — called from HTTP handler. Returns immediately after enqueue. */
export async function startVideoGeneration(input: VideoStartInput): Promise<VideoStartResult> {
  const apiKey = openAiKey();
  if (!apiKey) return { ok: false, error: "video_gen_no_api_key" };
  if (!isS3Configured()) return { ok: false, error: "video_gen_s3_not_configured" };

  const platform = networkToVideoPlatform(input.network);
  const dims = getVideoDimensions(platform);

  const brandingResult = await getWorkspaceBranding(input.tenantId);
  const branding = brandingResult.ok ? brandingResult.branding : undefined;

  const scriptGenResult = await generateVideoScript({
    apiKey,
    brief: input.brief,
    platform,
    brandName: branding?.displayName ?? undefined,
  });

  if (!scriptGenResult.ok) return { ok: false, error: scriptGenResult.error };

  const { title, scenes, hashtags } = scriptGenResult;
  const totalDurationS = scenes.reduce((s, sc) => s + sc.durationSeconds, 0);

  const voiceoverText = scenes.map((s) => s.voiceoverText).join(" ");
  const modResult = await moderateText(apiKey, voiceoverText);
  if (modResult.ok && modResult.flagged) {
    return { ok: false, error: "video_gen_script_flagged" };
  }

  const scriptId = randomUUID();
  const jobId = randomUUID();

  const script = await insertVideoScript({
    id: scriptId,
    tenantId: input.tenantId,
    briefId: input.brief.briefId ?? null,
    platform,
    title,
    scenes,
    hashtags,
    voiceoverEnabled: input.voiceover ?? false,
    totalDurationS,
    status: "ready",
  });

  if (!script) return { ok: false, error: "video_gen_db_insert_failed" };

  await insertVideoRenderJob({
    id: jobId,
    tenantId: input.tenantId,
    scriptId,
    width: dims.width,
    height: dims.height,
    status: "queued",
  });

  await enqueueVideoRenderJob(input.queue, {
    scriptId,
    jobId,
    tenantId: input.tenantId,
    voiceover: input.voiceover ?? false,
    network: input.network ?? undefined,
  });

  console.info(JSON.stringify({
    level: "info", event: "video_gen_enqueued",
    tenantId: input.tenantId, scriptId, jobId, platform,
  }));

  return { ok: true, scriptId, jobId, status: "queued" };
}

/** Slow path — called by BullMQ worker. */
export async function executeVideoRender(input: VideoRenderInput): Promise<VideoRenderResult> {
  const apiKey = openAiKey();
  if (!apiKey) return { ok: false, error: "video_render_no_api_key" };

  const script = await getVideoScript(input.tenantId, input.scriptId);
  if (!script) return { ok: false, error: "video_render_script_not_found" };

  await updateVideoScript(input.tenantId, input.scriptId, { status: "rendering" });
  await updateVideoRenderJob(input.tenantId, input.jobId, { status: "rendering" });

  const scenes = script.scenes_json;
  const dims = getVideoDimensions(script.platform as Parameters<typeof getVideoDimensions>[0]);

  const brandingResult = await getWorkspaceBranding(input.tenantId);
  const branding = brandingResult.ok ? brandingResult.branding : undefined;
  const logoBuffer = branding?.logoUrl ? await fetchLogoBuffer(branding.logoUrl) : undefined;

  const sceneImages: Buffer[] = [];
  for (const scene of scenes) {
    const imgResult = await generateImageWithDalle({
      apiKey,
      prompt: scene.imagePrompt,
      size: dims.width > dims.height ? "1792x1024" : "1024x1792",
      quality: "standard",
    });

    if (!imgResult.ok) {
      await updateVideoScript(input.tenantId, input.scriptId, {
        status: "failed",
        error: `scene_image_failed: ${imgResult.error}`,
      });
      await updateVideoRenderJob(input.tenantId, input.jobId, {
        status: "failed",
        error: `scene_image_failed: ${imgResult.error}`,
      });
      return { ok: false, error: "video_render_scene_image_failed" };
    }
    sceneImages.push(Buffer.from(imgResult.b64, "base64"));
  }

  let audioBuffer: Buffer | undefined;
  if (input.voiceover) {
    const voiceoverText = scenes.map((s: { voiceoverText: string }) => s.voiceoverText).join(" ");
    if (voiceoverText.trim()) {
      const ttsResult = await generateVoiceover({ apiKey, text: voiceoverText });
      if (ttsResult.ok) audioBuffer = ttsResult.buffer;
    }
  }

  const renderResult = await renderVideoSlideshow({
    scenes,
    sceneImages,
    audioBuffer,
    logoBuffer,
    width: dims.width,
    height: dims.height,
  });

  if (!renderResult.ok) {
    await updateVideoScript(input.tenantId, input.scriptId, { status: "failed", error: renderResult.error });
    await updateVideoRenderJob(input.tenantId, input.jobId, { status: "failed", error: renderResult.error });
    return { ok: false, error: "video_render_ffmpeg_failed" };
  }

  const s3Key = `generated-videos/${input.tenantId}/${input.scriptId}/${input.jobId}.mp4`;
  const uploadResult = await uploadBufferToS3(renderResult.buffer, s3Key, "video/mp4");

  if (!uploadResult.ok) {
    await updateVideoScript(input.tenantId, input.scriptId, { status: "failed", error: "s3_upload_failed" });
    await updateVideoRenderJob(input.tenantId, input.jobId, { status: "failed", error: uploadResult.error });
    return { ok: false, error: "video_render_s3_upload_failed" };
  }

  let thumbnailUrl: string | null = null;
  const thumbResult = await extractThumbnail(renderResult.buffer, dims.width, dims.height);
  if (thumbResult.ok) {
    const thumbKey = `generated-videos/${input.tenantId}/${input.scriptId}/${input.jobId}_thumb.jpg`;
    const thumbUpload = await uploadBufferToS3(thumbResult.buffer, thumbKey, "image/jpeg");
    if (thumbUpload.ok) thumbnailUrl = thumbUpload.url;
  }

  await updateVideoScript(input.tenantId, input.scriptId, { status: "rendered" });
  await updateVideoRenderJob(input.tenantId, input.jobId, {
    status: "done",
    s3Key,
    url: uploadResult.url,
    thumbnailUrl,
    durationS: renderResult.durationS,
  });

  console.info(JSON.stringify({
    level: "info", event: "video_rendered",
    tenantId: input.tenantId, scriptId: input.scriptId, jobId: input.jobId,
    durationS: renderResult.durationS, sizeBytes: renderResult.buffer.byteLength,
    hasThumbnail: !!thumbnailUrl,
  }));

  return { ok: true, url: uploadResult.url, thumbnailUrl, durationS: renderResult.durationS };
}
