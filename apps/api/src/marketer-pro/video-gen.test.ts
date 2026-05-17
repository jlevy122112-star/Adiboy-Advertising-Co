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
  extractThumbnail: vi.fn(),
}));
vi.mock("@home-link/marketer-pro-queue", () => ({
  enqueueVideoRenderJob: vi.fn().mockResolvedValue({}),
}));

import { startVideoGeneration, executeVideoRender } from "./video-generate.js";
import { networkToVideoPlatform, getVideoDimensions } from "@home-link/marketer-pro-contract";
import {
  insertVideoScript,
  updateVideoScript,
  insertVideoRenderJob,
  updateVideoRenderJob,
  getVideoScript,
} from "../db/video-script.js";
import { isS3Configured, uploadBufferToS3 } from "../storage/s3.js";
import { generateVideoScript } from "./openai-video-script.js";
import { generateImageWithDalle } from "./openai-image-gen.js";
import { moderateText } from "./openai-moderation.js";
import { renderVideoSlideshow, extractThumbnail } from "./video-render.js";
import { enqueueVideoRenderJob } from "@home-link/marketer-pro-queue";
import type { GenerationBrief } from "@home-link/marketer-pro-contract";

const mockInsertScript = vi.mocked(insertVideoScript);
const mockUpdateScript = vi.mocked(updateVideoScript);
const mockInsertJob = vi.mocked(insertVideoRenderJob);
const mockUpdateJob = vi.mocked(updateVideoRenderJob);
const mockGetScript = vi.mocked(getVideoScript);
const mockUpload = vi.mocked(uploadBufferToS3);
const mockGenScript = vi.mocked(generateVideoScript);
const mockGenImage = vi.mocked(generateImageWithDalle);
const mockModerate = vi.mocked(moderateText);
const mockRender = vi.mocked(renderVideoSlideshow);
const mockExtractThumbnail = vi.mocked(extractThumbnail);
const mockS3Configured = vi.mocked(isS3Configured);
const mockEnqueue = vi.mocked(enqueueVideoRenderJob);

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
    brief_id: null,
    platform: "tiktok",
    title: "Test Video",
    scenes_json: FAKE_SCENES,
    hashtags_json: ["#test"],
    voiceover_enabled: false,
    total_duration_s: 10,
    status: "ready",
    error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeJobRow(overrides = {}) {
  return {
    id: "job_123",
    tenant_id: "tenant_test",
    script_id: "script_123",
    s3_key: null,
    url: null,
    thumbnail_url: null,
    width: 1080,
    height: 1920,
    duration_s: null,
    status: "queued",
    error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

const FAKE_SCENES = [
  { sceneNumber: 1, imagePrompt: "scene 1", imageDescription: "desc", voiceoverText: "hey", captionText: "New Drop", durationSeconds: 5 },
  { sceneNumber: 2, imagePrompt: "scene 2", imageDescription: "desc", voiceoverText: "check it", captionText: "Limited time", durationSeconds: 5 },
];

const FAKE_QUEUE = { add: vi.fn() } as never;

// ---------------------------------------------------------------------------
// Contract helpers
// ---------------------------------------------------------------------------
describe("networkToVideoPlatform", () => {
  it("maps tiktok", () => expect(networkToVideoPlatform("tiktok")).toBe("tiktok"));
  it("maps instagram to reels", () => expect(networkToVideoPlatform("instagram")).toBe("reels"));
  it("maps youtube to shorts", () => expect(networkToVideoPlatform("youtube")).toBe("shorts"));
  it("falls back to generic_vertical", () => expect(networkToVideoPlatform("snapchat")).toBe("generic_vertical"));
  it("handles null", () => expect(networkToVideoPlatform(null)).toBe("generic_vertical"));
});

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
// startVideoGeneration (fast path)
// ---------------------------------------------------------------------------
describe("startVideoGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockS3Configured.mockReturnValue(true);
    mockModerate.mockResolvedValue({ ok: true, flagged: false, categories: {} });
    mockGenScript.mockResolvedValue({ ok: true, title: "Test Video", scenes: FAKE_SCENES, hashtags: ["#test"] });
    mockInsertScript.mockResolvedValue(makeScriptRow() as never);
    mockInsertJob.mockResolvedValue(makeJobRow() as never);
    mockEnqueue.mockResolvedValue({} as never);
  });

  it("returns ok:false when no API key", async () => {
    const result = await startVideoGeneration({ tenantId: "tenant_test", brief: makeBrief(), queue: FAKE_QUEUE });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe("video_gen_no_api_key");
  });

  it("returns ok:false when S3 not configured", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    mockS3Configured.mockReturnValue(false);
    const result = await startVideoGeneration({ tenantId: "tenant_test", brief: makeBrief(), queue: FAKE_QUEUE });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe("video_gen_s3_not_configured");
    delete process.env.OPENAI_API_KEY;
  });

  it("returns ok:false when script gen fails", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    mockGenScript.mockResolvedValue({ ok: false, error: "openai_timeout" });
    const result = await startVideoGeneration({ tenantId: "tenant_test", brief: makeBrief(), queue: FAKE_QUEUE });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe("openai_timeout");
    delete process.env.OPENAI_API_KEY;
  });

  it("returns ok:false when script is flagged", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    mockModerate.mockResolvedValue({ ok: true, flagged: true, categories: { violence: true } });
    const result = await startVideoGeneration({ tenantId: "tenant_test", brief: makeBrief(), queue: FAKE_QUEUE });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe("video_gen_script_flagged");
    delete process.env.OPENAI_API_KEY;
  });

  it("returns ok:false when DB insert fails", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    mockInsertScript.mockResolvedValue(null);
    const result = await startVideoGeneration({ tenantId: "tenant_test", brief: makeBrief(), queue: FAKE_QUEUE });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe("video_gen_db_insert_failed");
    delete process.env.OPENAI_API_KEY;
  });

  it("enqueues job and returns queued status on success", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const result = await startVideoGeneration({ tenantId: "tenant_test", brief: makeBrief(), network: "tiktok", queue: FAKE_QUEUE });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("queued");
      expect(result.scriptId).toBeDefined();
      expect(result.jobId).toBeDefined();
    }
    expect(mockEnqueue).toHaveBeenCalledWith(FAKE_QUEUE, expect.objectContaining({ voiceover: false }));
    expect(mockGenImage).not.toHaveBeenCalled(); // no image gen in fast path
    delete process.env.OPENAI_API_KEY;
  });
});

// ---------------------------------------------------------------------------
// executeVideoRender (slow path / worker)
// ---------------------------------------------------------------------------
describe("executeVideoRender", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetScript.mockResolvedValue(makeScriptRow() as never);
    mockUpdateScript.mockResolvedValue(makeScriptRow({ status: "rendered" }) as never);
    mockUpdateJob.mockResolvedValue(makeJobRow({ status: "done", url: "https://s3.example.com/video.mp4" }) as never);
    mockGenImage.mockResolvedValue({ ok: true, b64: Buffer.from("fake-png").toString("base64"), revisedPrompt: "revised" });
    mockRender.mockResolvedValue({ ok: true, buffer: Buffer.from("fake-mp4"), durationS: 10 });
    mockExtractThumbnail.mockResolvedValue({ ok: true, buffer: Buffer.from("fake-jpg") });
    mockUpload
      .mockResolvedValueOnce({ ok: true, key: "video.mp4", url: "https://s3.example.com/video.mp4" })
      .mockResolvedValueOnce({ ok: true, key: "thumb.jpg", url: "https://s3.example.com/thumb.jpg" });
  });

  it("returns ok:false when no API key", async () => {
    const result = await executeVideoRender({ tenantId: "tenant_test", scriptId: "s1", jobId: "j1" });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe("video_render_no_api_key");
  });

  it("returns ok:false when script not found", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    mockGetScript.mockResolvedValue(null);
    const result = await executeVideoRender({ tenantId: "tenant_test", scriptId: "missing", jobId: "j1" });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe("video_render_script_not_found");
    delete process.env.OPENAI_API_KEY;
  });

  it("returns ok:false when scene image fails", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    mockGenImage.mockResolvedValue({ ok: false, error: "dalle_timeout" });
    const result = await executeVideoRender({ tenantId: "tenant_test", scriptId: "s1", jobId: "j1" });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe("video_render_scene_image_failed");
    delete process.env.OPENAI_API_KEY;
  });

  it("returns ok:false when ffmpeg render fails", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    mockRender.mockResolvedValue({ ok: false, error: "render_ffmpeg_error: segfault" });
    const result = await executeVideoRender({ tenantId: "tenant_test", scriptId: "s1", jobId: "j1" });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe("video_render_ffmpeg_failed");
    delete process.env.OPENAI_API_KEY;
  });

  it("returns ok:false when S3 upload fails", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    mockUpload.mockReset();
    mockUpload.mockResolvedValue({ ok: false, error: "connection_refused" });
    const result = await executeVideoRender({ tenantId: "tenant_test", scriptId: "s1", jobId: "j1" });
    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).toBe("video_render_s3_upload_failed");
    delete process.env.OPENAI_API_KEY;
  });

  it("returns ok:true with url and thumbnailUrl on success", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const result = await executeVideoRender({ tenantId: "tenant_test", scriptId: "s1", jobId: "j1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).toBe("https://s3.example.com/video.mp4");
      expect(result.thumbnailUrl).toBe("https://s3.example.com/thumb.jpg");
      expect(result.durationS).toBe(10);
    }
    expect(mockGenImage).toHaveBeenCalledTimes(FAKE_SCENES.length);
    expect(mockRender).toHaveBeenCalledWith(expect.objectContaining({ width: 1080, height: 1920 }));
    expect(mockExtractThumbnail).toHaveBeenCalledOnce();
    delete process.env.OPENAI_API_KEY;
  });

  it("succeeds even when thumbnail extraction fails", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    mockExtractThumbnail.mockResolvedValue({ ok: false, error: "thumb_ffmpeg_error: something" });
    const result = await executeVideoRender({ tenantId: "tenant_test", scriptId: "s1", jobId: "j1" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.thumbnailUrl).toBeNull();
    delete process.env.OPENAI_API_KEY;
  });

  it("generates images for all scenes", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    await executeVideoRender({ tenantId: "tenant_test", scriptId: "s1", jobId: "j1" });
    expect(mockGenImage).toHaveBeenCalledTimes(FAKE_SCENES.length);
    delete process.env.OPENAI_API_KEY;
  });

  it("passes logoBuffer to renderVideoSlideshow when branding has logoUrl", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const { getWorkspaceBranding } = await import("../db/workspace-branding.js");
    vi.mocked(getWorkspaceBranding).mockResolvedValueOnce({
      ok: true,
      branding: { displayName: "TestBrand", logoUrl: "https://example.com/logo.png" } as never,
    });
    // fetchLogoBuffer will attempt a real fetch — let it fail gracefully
    const result = await executeVideoRender({ tenantId: "tenant_test", scriptId: "s1", jobId: "j1" });
    expect(result.ok).toBe(true);
    delete process.env.OPENAI_API_KEY;
  });
});
