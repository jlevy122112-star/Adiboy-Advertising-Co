/**
 * Phase 7 video generation orchestrator.
 *
 * Flow:
 *   1. Generate script from brief (OpenAI)
 *   2. Moderate script text
 *   3. Generate one image per scene (DALL-E 3)
 *   4. Optionally generate voiceover (TTS)
 *   5. Render MP4 via ffmpeg
 *   6. Upload to S3
 *   7. Persist script + render job rows
 *
 * Env: MARKETER_OPENAI_API_KEY / OPENAI_API_KEY, AWS_*
 */

import { randomUUID } from "node:crypto";
import type { GenerationBrief } from "@home-link/marketer-pro-contract";
import { networkToVideoPlatform, getVideoDimensions } from "@home-link/marketer-pro-contract";
import { generateVideoScript } from "./openai-video-script.js";
import { generateImageWithDalle } from "./openai-image-gen.js";
import { generateVoiceover } from "./openai-tts.js";
import { moderateText } from "./openai-moderation.js";
import { renderVideoSlideshow } from "./video-render.js";
import { uploadBufferToS3, isS3Configured } from "../storage/s3.js";
import { getWorkspaceBranding } from "../db/workspace-branding.js";
import {
  insertVideoScript,
  updateVideoScript,
  insertVideoRenderJob,
  updateVideoRenderJob,
  type VideoScriptRow,
  type VideoRenderJobRow,
} from "../db/video-script.js";

export type VideoGenerateInput = {
  tenantId: string;
  brief: GenerationBrief;
  network?: string | null;
  voiceover?: boolean;
  scheduleEntryId?: string | null;
};

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

export async function generateVideo(input: VideoGenerateInput): Promise<VideoGenerateResult> {
  const apiKey = openAiKey();
  if (!apiKey) return { ok: false, error: "video_gen_no_api_key" };
  if (!isS3Configured()) return { ok: false, error: "video_gen_s3_not_configured" };

  const platform = networkToVideoPlatform(input.network);
  const dimensions = getVideoDimensions(platform);

  const brandingResult = await getWorkspaceBranding(input.tenantId);
  const branding = brandingResult.ok ? brandingResult.branding : undefined;

  // Generate script
  const scriptGenResult = await generateVideoScript({
    apiKey,
    brief: input.brief,
    platform,
    brandName: branding?.displayName ?? undefined,
  });

  if (!scriptGenResult.ok) {
    return { ok: false, error: scriptGenResult.error };
  }

  const { title, scenes, hashtags } = scriptGenResult;
  const totalDurationS = scenes.reduce((s, sc) => s + sc.durationSeconds, 0);
  const scriptId = randomUUID();

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
    status: "generating",
  });

  if (!script) return { ok: false, error: "video_gen_db_insert_failed" };

  // Moderate combined voiceover text
  const voiceoverText = scenes.map((s) => s.voiceoverText).join(" ");
  const modResult = await moderateText(apiKey, voiceoverText);
  if (modResult.ok && modResult.flagged) {
    await updateVideoScript(input.tenantId, scriptId, {
      status: "failed",
      error: "script_flagged_by_moderation",
    });
    return { ok: false, error: "video_gen_script_flagged", script };
  }

  // Generate scene images
  const sceneImages: Buffer[] = [];
  for (const scene of scenes) {
    const imgResult = await generateImageWithDalle({
      apiKey,
      prompt: scene.imagePrompt,
      size: dimensions.width > dimensions.height ? "1792x1024" : "1024x1792",
      quality: "standard",
    });

    if (!imgResult.ok) {
      await updateVideoScript(input.tenantId, scriptId, {
        status: "failed",
        error: `scene_image_failed: ${imgResult.error}`,
      });
      return { ok: false, error: `video_gen_scene_image_failed`, script };
    }
    sceneImages.push(Buffer.from(imgResult.b64, "base64"));
  }

  // Optional voiceover
  let audioBuffer: Buffer | undefined;
  if (input.voiceover && voiceoverText.trim()) {
    const ttsResult = await generateVoiceover({ apiKey, text: voiceoverText });
    if (ttsResult.ok) {
      audioBuffer = ttsResult.buffer;
    }
    // non-fatal if TTS fails — render without audio
  }

  // Render MP4
  const renderResult = await renderVideoSlideshow({
    scenes,
    sceneImages,
    audioBuffer,
    width: dimensions.width,
    height: dimensions.height,
  });

  if (!renderResult.ok) {
    await updateVideoScript(input.tenantId, scriptId, {
      status: "failed",
      error: renderResult.error,
    });
    return { ok: false, error: `video_gen_render_failed`, script };
  }

  // Upload to S3
  const jobId = randomUUID();
  const s3Key = `generated-videos/${input.tenantId}/${scriptId}/${jobId}.mp4`;

  await insertVideoRenderJob({
    id: jobId,
    tenantId: input.tenantId,
    scriptId,
    width: dimensions.width,
    height: dimensions.height,
    status: "uploading",
  });

  const uploadResult = await uploadBufferToS3(renderResult.buffer, s3Key, "video/mp4");

  if (!uploadResult.ok) {
    await updateVideoScript(input.tenantId, scriptId, { status: "failed", error: "s3_upload_failed" });
    await updateVideoRenderJob(input.tenantId, jobId, { status: "failed", error: uploadResult.error });
    return { ok: false, error: "video_gen_s3_upload_failed", script };
  }

  const finalScript = await updateVideoScript(input.tenantId, scriptId, { status: "rendered" });
  const finalJob = await updateVideoRenderJob(input.tenantId, jobId, {
    status: "done",
    s3Key,
    url: uploadResult.url,
    durationS: renderResult.durationS,
  });

  console.info(JSON.stringify({
    level: "info",
    event: "video_generated",
    tenantId: input.tenantId,
    scriptId,
    jobId,
    platform,
    durationS: renderResult.durationS,
    sizeBytes: renderResult.buffer.byteLength,
  }));

  return { ok: true, script: finalScript ?? script, job: finalJob! };
}
