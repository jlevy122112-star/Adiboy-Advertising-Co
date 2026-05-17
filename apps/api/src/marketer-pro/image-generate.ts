/**
 * Phase 6 image generation orchestrator.
 *
 * Flow:
 *   1. Build prompt from brief + brand context
 *   2. Moderate the prompt (skip if no API key)
 *   3. Generate image via DALL-E 3
 *   4. Upload PNG to S3
 *   5. Persist generated_asset row
 *
 * Env vars:
 *   MARKETER_OPENAI_API_KEY / OPENAI_API_KEY  — required for generation
 *   AWS_*                                      — required for S3 upload
 *
 * Returns the asset row on success.
 */

import { randomUUID } from "node:crypto";
import type { GenerationBrief } from "@home-link/marketer-pro-contract";
import { getDimensions } from "./image-dimensions.js";
import { buildImagePrompt } from "./image-prompt-builder.js";
import { buildBrandContext } from "./brand-context-builder.js";
import { generateImageWithDalle } from "./openai-image-gen.js";
import { moderateText } from "./openai-moderation.js";
import { uploadBufferToS3, isS3Configured } from "../storage/s3.js";
import { getWorkspaceBranding } from "../db/workspace-branding.js";
import { getLatestBrandProfile } from "../db/brand-profile.js";
import {
  insertGeneratedAsset,
  updateGeneratedAsset,
  type GeneratedAssetRow,
} from "../db/generated-asset.js";

export type ImageGenerateInput = {
  tenantId: string;
  brief: GenerationBrief;
  network?: string | null;
  scheduleEntryId?: string | null;
  quality?: "standard" | "hd";
  customInstruction?: string;
};

export type ImageGenerateResult =
  | { ok: true; asset: GeneratedAssetRow }
  | { ok: false; error: string; asset?: GeneratedAssetRow };

function openAiKey(): string | undefined {
  return (
    process.env.MARKETER_OPENAI_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    undefined
  );
}

export async function generateImage(
  input: ImageGenerateInput,
): Promise<ImageGenerateResult> {
  const apiKey = openAiKey();
  if (!apiKey) {
    return { ok: false, error: "image_gen_no_api_key" };
  }
  if (!isS3Configured()) {
    return { ok: false, error: "image_gen_s3_not_configured" };
  }

  const dimensions = getDimensions(input.network);

  // Build full brand context from branding + brand intelligence profile
  const brandingResult = await getWorkspaceBranding(input.tenantId);
  const branding = brandingResult.ok ? brandingResult.branding : undefined;
  const profileResult = await getLatestBrandProfile(input.tenantId);
  const profile = profileResult.ok ? profileResult.profile : undefined;
  const brand = branding ? buildBrandContext(branding, profile) : undefined;

  const prompt = buildImagePrompt({
    brief: input.brief,
    dimensions,
    brand,
    customInstruction: input.customInstruction,
  });

  const assetId = randomUUID();

  // Insert placeholder row so callers can poll status
  const asset = await insertGeneratedAsset({
    id: assetId,
    tenantId: input.tenantId,
    scheduleEntryId: input.scheduleEntryId ?? null,
    briefId: input.brief.briefId ?? null,
    provider: "dalle3",
    prompt,
    network: input.network ?? null,
    width: dimensions.width,
    height: dimensions.height,
    status: "generating",
  });

  if (!asset) {
    return { ok: false, error: "image_gen_db_insert_failed" };
  }

  // Moderate the prompt first
  const modResult = await moderateText(apiKey, prompt);
  if (modResult.ok && modResult.flagged) {
    const updated = await updateGeneratedAsset(input.tenantId, assetId, {
      status: "rejected",
      moderationFlagged: true,
      moderationDetail: modResult.categories as Record<string, unknown>,
      error: "prompt_flagged_by_moderation",
    });
    return {
      ok: false,
      error: "image_gen_prompt_flagged",
      asset: updated ?? asset,
    };
  }

  // Generate with DALL-E 3
  const genResult = await generateImageWithDalle({
    apiKey,
    prompt,
    size: dimensions.dalleSize,
    quality: input.quality ?? "standard",
  });

  if (!genResult.ok) {
    const updated = await updateGeneratedAsset(input.tenantId, assetId, {
      status: "failed",
      error: genResult.error,
    });
    return { ok: false, error: genResult.error, asset: updated ?? asset };
  }

  // Upload PNG buffer to S3
  const pngBuffer = Buffer.from(genResult.b64, "base64");
  const s3Key = `generated-assets/${input.tenantId}/${assetId}.png`;
  const uploadResult = await uploadBufferToS3(pngBuffer, s3Key, "image/png");

  if (!uploadResult.ok) {
    const updated = await updateGeneratedAsset(input.tenantId, assetId, {
      status: "failed",
      revisedPrompt: genResult.revisedPrompt,
      error: `s3_upload_failed:${uploadResult.error}`,
    });
    return {
      ok: false,
      error: `image_gen_s3_upload_failed`,
      asset: updated ?? asset,
    };
  }

  // Persist final state
  const finalAsset = await updateGeneratedAsset(input.tenantId, assetId, {
    status: "moderation_pending",
    revisedPrompt: genResult.revisedPrompt,
    s3Key,
    url: uploadResult.url,
    moderationFlagged: false,
  });

  console.info(JSON.stringify({
    level: "info",
    event: "image_generated",
    tenantId: input.tenantId,
    assetId,
    network: input.network,
    sizeBytes: pngBuffer.byteLength,
  }));

  return { ok: true, asset: finalAsset ?? asset };
}
