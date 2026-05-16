/**
 * Unit tests for Phase 7 video generation.
 * All external I/O mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db/video-script.js", () => ({
  insertVideoScript: vi.fn(),
  updateVideoScript: vi.fn(),
  getVideoScript: vi.fn(),
  listVideoScripts: vi.fn(),
  insertVideoRenderJob: vi.fn(),
  updateVideoRenderJob: vi.fn(),
  getVideoRenderJob: vi.fn(),
  listVideoRenderJobs: vi.fn(),
}));
vi.mock("../db/workspace-branding.js", () => ({
  getWorkspaceBranding: vi.fn().mockResolvedValue({ ok: false }),
}));
vi.mock("../storage/s3.js", () => ({
  isS3Configured: vi.fn().mockReturnValue(true),
  uploadBufferToS3: vi.fn(),
}));
vi.mock("./openai-video-script.js", () => ({
  generateVideoScript: vi.fn(),
}));
vi.mock("./openai-image-gen.js", () => ({
  generateImageWithDalle: vi.fn(),
}));
vi.mock("./openai-tts.js", () => ({
  generateVoiceover: vi.fn(),
}));
vi.mock("./openai-moderation.js", () => ({
  moderateText: vi.fn().mockResolvedValue({ ok: true, flagged: false, categories: {} }),
}));
vi.mock("./video-render.js", () => ({
  renderVideoSlideshow: vi.fn(),
}));

import { generateVideo } from "./video-generate.js";
import { networkToVideoPlatform, getVideoDimensions } from "@home-link/marketer-pro-contract";
import {
  insertVideoScript,
  updateVideoScript,
  insertVideoRenderJob,
  updateVideoRenderJob,
} from "../db/video-script.js";
import { isS3Configured, uploadBufferToS3 } from "../storage/s3.js";
import { generateVideoScript } from "./openai-video-script.js";
import { generateImageWithDalle } from "./openai-image-gen.js";
import { moderateText } from "./openai-moderation.js";
import { renderVideoSlideshow } from "./video-render.js";
import type { GenerationBrief } from "@home-link/marketer-pro-contract";

const mockInsertScript = vi.mocked(insertVideoScript);
const mockUpdateScript = vi.mocked(updateVideoScript);
const mockInsertJob = vi.mocked(insertVideoRenderJob);
const mockUpdateJob = vi.mocked(updateVideoRenderJob);
const mockUpload = vi.mocked(uploadBufferToS3);
const mockGenScript = vi.mocked(generateVideoScript);
const mockGenImage = vi.mocked(generateImageWithDalle);
const mockModerate = vi.mocked(moderateText);
const mockRender = vi.mocked(renderVideoSlideshow);
const mockS3Configured = vi.mocked(isS3Configured);

function makeBrief(overrides: Partial<GenerationBrief> = {}): GenerationBrief {
  return {
    briefId: "brief_test_1",
    workspaceId: "tenant_test",
    formatId: "tiktok_vertical",
    status: "validated",
    source: "manual_user",
    copy: { headline: "New Drop", body: "Check it out." },
    design: { imageryDirection: "vibrant street style", mood: "hype" },
    voice: {},
    fieldSources: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as unknown as GenerationBrief;
}

function makeScriptRow(overrides = {}) {
  return {
    id: "script_123",
    tenant_id: "tenant_test",
    platform: "tiktok",
    status: "generating",
    scenes_json: [],
    ...overrides,
  };
}

function makeJobRow(overrides = {}) {
  return {
    id: "job_123",
    tenant_id: "tenant_test",
    script_id: "script_123",
    status: "queued",
    ...overrides,
  };
}

const FAKE_SCENES = [
  { sceneNumber: 1, imagePrompt: "scene 1", imageDescription: "desc", voiceoverText: "hey", captionText: "New Drop", durationSeconds: 5 },
  { sceneNumber: 2, imagePrompt: "scene 2", imageDescription: "desc", voiceoverText: "check it", captionText: "Limited time", durationSeconds: 5 },
];

// ---------------------------------------------------------------------------
// networkToVideoPlatform
// ---------------------------------------------------------------------------
describe("networkToVideoPlatform", () => {
  it("maps tiktok", () => expect(networkToVideoPlatform("tiktok")).toBe("tiktok"));
  it("maps instagram to reels", () => expect(networkToVideoPlatform("instagram")).toBe("reels"));
  it("maps youtube to shorts", () => expect(networkToVideoPlatform("youtube")).toBe("shorts"));
  it("falls back to generic_vertical", () => expect(networkToVideoPlatform("snapchat")).toBe("generic_vertical"));
  it("handles null", () => expect(networkToVideoPlatform(null)).toBe("generic_vertical"));
});

// ---------------------------------------------------------------------------
// getVideoDimensions
// ---------------------------------------------------------------------------
describe("getVideoDimensions", () => {
  it("tiktok is 1080x1920", () => {
    const d = getVideoDimensions("tiktok");
    expect(d.width).toBe(1080);
    expect(d.height).toBe(1920);
    expect(d.ffmpegSize).toBe("1080x1920");
  });

  it("generic_landscape is 1920x1080", () => {
    const d = getVideoDimensions("generic_landscape");
    expect(d.width).toBe(1920);
    expect(d.height).toBe(1080);
  });
});

// ---------------------------------------------------------------------------
// generateVideo orchestrator
// ---------------------------------------------------------------------------
describe("generateVideo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockS3Configured.mockReturnValue(true);
    mockModerate.mockResolvedValue({ ok: true, flagged: false, categories: {} });
    mockGenScript.mockResolvedValue({ ok: true, title: "New Drop Video", scenes: FAKE_SCENES, hashtags: ["#test"] });
    mockInsertScript.mockResolvedValue(makeScriptRow() as never);
    mockUpdateScript.mockResolvedValue(makeScriptRow({ status: "rendered" }) as never);
    mockGenImage.mockResolvedValue({ ok: true, b64: Buffer.from("fake-png").toString("base64"), revisedPrompt: "revised" });
    mockRender.mockResolvedValue({ ok: true, buffer: Buffer.from("fake-mp4"), durationS: 10 });
    mockInsertJob.mockResolvedValue(makeJobRow() as never);
    mockUpdateJob.mockResolvedValue(makeJobRow({ status: "done", url: "https://s3.example.com/video.mp4" }) as never);
    mockUpload.mockResolvedValue({ ok: true, key: "generated-videos/tenant_test/script_123/job_123.mp4", url: "https://s3.example.com/video.mp4" });
  });

  it("returns ok:false when no API key", async () => {
    const result = await generateVideo({ tenantId: "tenant_test", brief: makeBrief() });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe("video_gen_no_api_key");
  });

  it("returns ok:false when S3 not configured", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    mockS3Configured.mockReturnValue(false);
    const result = await generateVideo({ tenantId: "tenant_test", brief: makeBrief() });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe("video_gen_s3_not_configured");
    delete process.env.OPENAI_API_KEY;
  });

  it("returns ok:false when script gen fails", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    mockGenScript.mockResolvedValue({ ok: false, error: "openai_timeout" });
    const result = await generateVideo({ tenantId: "tenant_test", brief: makeBrief() });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe("openai_timeout");
    delete process.env.OPENAI_API_KEY;
  });

  it("returns ok:false and marks failed when script is flagged", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    mockModerate.mockResolvedValue({ ok: true, flagged: true, categories: { violence: true } });
    const result = await generateVideo({ tenantId: "tenant_test", brief: makeBrief() });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe("video_gen_script_flagged");
    expect(mockUpdateScript).toHaveBeenCalledWith("tenant_test", expect.any(String), expect.objectContaining({ status: "failed" }));
    delete process.env.OPENAI_API_KEY;
  });

  it("returns ok:false when scene image fails", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    mockGenImage.mockResolvedValue({ ok: false, error: "dalle_timeout" });
    const result = await generateVideo({ tenantId: "tenant_test", brief: makeBrief() });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe("video_gen_scene_image_failed");
    delete process.env.OPENAI_API_KEY;
  });

  it("returns ok:false when ffmpeg render fails", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    mockRender.mockResolvedValue({ ok: false, error: "render_ffmpeg_error: segfault" });
    const result = await generateVideo({ tenantId: "tenant_test", brief: makeBrief() });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe("video_gen_render_failed");
    delete process.env.OPENAI_API_KEY;
  });

  it("returns ok:false when S3 upload fails", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    mockUpload.mockResolvedValue({ ok: false, error: "connection_refused" });
    const result = await generateVideo({ tenantId: "tenant_test", brief: makeBrief() });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe("video_gen_s3_upload_failed");
    delete process.env.OPENAI_API_KEY;
  });

  it("returns ok:true on success", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const result = await generateVideo({ tenantId: "tenant_test", brief: makeBrief(), network: "tiktok" });
    expect(result.ok).toBe(true);
    expect(mockGenScript).toHaveBeenCalledWith(expect.objectContaining({ platform: "tiktok" }));
    expect(mockGenImage).toHaveBeenCalledTimes(FAKE_SCENES.length);
    expect(mockRender).toHaveBeenCalledWith(expect.objectContaining({ width: 1080, height: 1920 }));
    expect(mockUpload).toHaveBeenCalledWith(expect.any(Buffer), expect.stringContaining("generated-videos/"), "video/mp4");
    delete process.env.OPENAI_API_KEY;
  });

  it("generates images for all scenes", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    await generateVideo({ tenantId: "tenant_test", brief: makeBrief() });
    expect(mockGenImage).toHaveBeenCalledTimes(FAKE_SCENES.length);
    delete process.env.OPENAI_API_KEY;
  });
});
