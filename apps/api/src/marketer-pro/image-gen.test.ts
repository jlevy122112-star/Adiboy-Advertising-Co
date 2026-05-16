/**
 * Unit tests for Phase 6 image generation — prompt builder, dimensions, orchestrator.
 * All external I/O mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db/generated-asset.js", () => ({
  insertGeneratedAsset: vi.fn(),
  updateGeneratedAsset: vi.fn(),
  getGeneratedAsset: vi.fn(),
  listGeneratedAssets: vi.fn(),
}));
vi.mock("../db/workspace-branding.js", () => ({
  getWorkspaceBranding: vi.fn().mockResolvedValue({ ok: false }),
}));
vi.mock("../storage/s3.js", () => ({
  isS3Configured: vi.fn().mockReturnValue(true),
  uploadBufferToS3: vi.fn(),
}));
vi.mock("./openai-image-gen.js", () => ({
  generateImageWithDalle: vi.fn(),
}));
vi.mock("./openai-moderation.js", () => ({
  moderateText: vi.fn().mockResolvedValue({ ok: true, flagged: false, categories: {} }),
}));

import { buildImagePrompt } from "./image-prompt-builder.js";
import { getDimensions } from "./image-dimensions.js";
import { generateImage } from "./image-generate.js";
import { insertGeneratedAsset, updateGeneratedAsset } from "../db/generated-asset.js";
import { uploadBufferToS3, isS3Configured } from "../storage/s3.js";
import { generateImageWithDalle } from "./openai-image-gen.js";
import { moderateText } from "./openai-moderation.js";
import type { GenerationBrief } from "@home-link/marketer-pro-contract";

const mockInsert = vi.mocked(insertGeneratedAsset);
const mockUpdate = vi.mocked(updateGeneratedAsset);
const mockUpload = vi.mocked(uploadBufferToS3);
const mockGenerate = vi.mocked(generateImageWithDalle);
const mockModerate = vi.mocked(moderateText);
const mockS3Configured = vi.mocked(isS3Configured);

function makeBrief(overrides: Partial<GenerationBrief> = {}): GenerationBrief {
  return {
    briefId: "brief_test_1",
    workspaceId: "tenant_test",
    formatId: "instagram_square",
    status: "validated",
    source: "manual_user",
    copy: { headline: "Summer Sale is Here", body: "Up to 50% off all products." },
    design: { imageryDirection: "bright and energetic", mood: "exciting" },
    voice: {},
    fieldSources: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as unknown as GenerationBrief;
}

function makeAssetRow(overrides = {}) {
  return {
    id: "asset_123",
    tenant_id: "tenant_test",
    status: "generating",
    provider: "dalle3",
    prompt: "test prompt",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getDimensions
// ---------------------------------------------------------------------------
describe("getDimensions", () => {
  it("returns instagram square for instagram", () => {
    const d = getDimensions("instagram");
    expect(d.width).toBe(1080);
    expect(d.height).toBe(1080);
    expect(d.dalleSize).toBe("1024x1024");
  });

  it("returns widescreen for youtube", () => {
    const d = getDimensions("youtube");
    expect(d.dalleSize).toBe("1792x1024");
  });

  it("returns vertical for tiktok", () => {
    const d = getDimensions("tiktok");
    expect(d.dalleSize).toBe("1024x1792");
  });

  it("falls back to generic square for unknown network", () => {
    const d = getDimensions("snapchat_unknown");
    expect(d.dalleSize).toBe("1024x1024");
  });

  it("falls back to generic for null", () => {
    const d = getDimensions(null);
    expect(d.dalleSize).toBe("1024x1024");
  });
});

// ---------------------------------------------------------------------------
// buildImagePrompt
// ---------------------------------------------------------------------------
describe("buildImagePrompt", () => {
  it("includes headline in prompt", () => {
    const prompt = buildImagePrompt({
      brief: makeBrief(),
      dimensions: getDimensions("instagram"),
    });
    expect(prompt).toContain("Summer Sale is Here");
  });

  it("includes brand name when provided", () => {
    const prompt = buildImagePrompt({
      brief: makeBrief(),
      dimensions: getDimensions("instagram"),
      brandName: "Acme Corp",
    });
    expect(prompt).toContain("Acme Corp");
  });

  it("includes imagery direction from design directives", () => {
    const prompt = buildImagePrompt({
      brief: makeBrief(),
      dimensions: getDimensions("instagram"),
    });
    expect(prompt).toContain("bright and energetic");
  });

  it("includes platform label", () => {
    const prompt = buildImagePrompt({
      brief: makeBrief(),
      dimensions: getDimensions("linkedin"),
    });
    expect(prompt).toContain("LinkedIn");
  });

  it("includes no-text guardrail", () => {
    const prompt = buildImagePrompt({
      brief: makeBrief(),
      dimensions: getDimensions("instagram"),
    });
    expect(prompt).toContain("No text overlaid");
  });
});

// ---------------------------------------------------------------------------
// generateImage orchestrator
// ---------------------------------------------------------------------------
describe("generateImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockS3Configured.mockReturnValue(true);
    mockModerate.mockResolvedValue({ ok: true, flagged: false, categories: {} });
    mockInsert.mockResolvedValue(makeAssetRow({ status: "generating" as const }) as never);
    mockUpdate.mockResolvedValue(makeAssetRow({ status: "moderation_pending", s3_key: "generated-assets/tenant_test/asset_123.png", url: "https://s3.example.com/asset_123.png" }) as never);
    mockGenerate.mockResolvedValue({ ok: true, b64: Buffer.from("fake-png").toString("base64"), revisedPrompt: "revised" });
    mockUpload.mockResolvedValue({ ok: true, key: "generated-assets/tenant_test/asset_123.png", url: "https://s3.example.com/asset_123.png" });
  });

  it("returns ok:false when no API key", async () => {
    const result = await generateImage({ tenantId: "tenant_test", brief: makeBrief() });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe("image_gen_no_api_key");
  });

  it("returns ok:false when S3 not configured", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    mockS3Configured.mockReturnValue(false);
    const result = await generateImage({ tenantId: "tenant_test", brief: makeBrief() });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe("image_gen_s3_not_configured");
    delete process.env.OPENAI_API_KEY;
  });

  it("returns ok:false and marks rejected when prompt is flagged", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    mockModerate.mockResolvedValue({ ok: true, flagged: true, categories: { violence: true } });
    const result = await generateImage({ tenantId: "tenant_test", brief: makeBrief() });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe("image_gen_prompt_flagged");
    expect(mockUpdate).toHaveBeenCalledWith("tenant_test", expect.any(String), expect.objectContaining({ status: "rejected" }));
    delete process.env.OPENAI_API_KEY;
  });

  it("returns ok:false and marks failed when DALL-E errors", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    mockGenerate.mockResolvedValue({ ok: false, error: "dalle_timeout" });
    const result = await generateImage({ tenantId: "tenant_test", brief: makeBrief() });
    expect(result.ok).toBe(false);
    expect(mockUpdate).toHaveBeenCalledWith("tenant_test", expect.any(String), expect.objectContaining({ status: "failed" }));
    delete process.env.OPENAI_API_KEY;
  });

  it("returns ok:false when S3 upload fails", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    mockUpload.mockResolvedValue({ ok: false, error: "connection_refused" });
    const result = await generateImage({ tenantId: "tenant_test", brief: makeBrief() });
    expect(result.ok).toBe(false);
    expect(mockUpdate).toHaveBeenCalledWith("tenant_test", expect.any(String), expect.objectContaining({ status: "failed" }));
    delete process.env.OPENAI_API_KEY;
  });

  it("returns ok:true with asset on success", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const result = await generateImage({ tenantId: "tenant_test", brief: makeBrief(), network: "instagram" });
    expect(result.ok).toBe(true);
    expect(mockGenerate).toHaveBeenCalledWith(expect.objectContaining({ size: "1024x1024" }));
    expect(mockUpload).toHaveBeenCalledWith(expect.any(Buffer), expect.stringContaining("generated-assets/"), "image/png");
    delete process.env.OPENAI_API_KEY;
  });

  it("uses hd quality when specified", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    await generateImage({ tenantId: "tenant_test", brief: makeBrief(), quality: "hd" });
    expect(mockGenerate).toHaveBeenCalledWith(expect.objectContaining({ quality: "hd" }));
    delete process.env.OPENAI_API_KEY;
  });
});
