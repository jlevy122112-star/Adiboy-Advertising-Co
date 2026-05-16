import { z } from "zod";

export const VideoSceneSchema = z.object({
  sceneNumber: z.number().int().min(1),
  imagePrompt: z.string(),
  imageDescription: z.string(),
  voiceoverText: z.string(),
  captionText: z.string(),
  durationSeconds: z.number().min(1).max(30).default(5),
});
export type VideoScene = z.infer<typeof VideoSceneSchema>;

export const VideoScriptStatusSchema = z.enum([
  "draft",
  "generating",
  "ready",
  "rendering",
  "rendered",
  "failed",
]);
export type VideoScriptStatus = z.infer<typeof VideoScriptStatusSchema>;

export const VideoRenderJobStatusSchema = z.enum([
  "queued",
  "rendering",
  "uploading",
  "done",
  "failed",
]);
export type VideoRenderJobStatus = z.infer<typeof VideoRenderJobStatusSchema>;

export const VideoPlatformSchema = z.enum([
  "tiktok",
  "reels",
  "shorts",
  "generic_vertical",
  "generic_landscape",
]);
export type VideoPlatform = z.infer<typeof VideoPlatformSchema>;

export const VideoScriptSchema = z.object({
  scriptId: z.string(),
  workspaceId: z.string(),
  briefId: z.string().nullable().optional(),
  platform: VideoPlatformSchema,
  title: z.string(),
  totalDurationSeconds: z.number(),
  scenes: z.array(VideoSceneSchema).min(1).max(10),
  hashtags: z.array(z.string()).default([]),
  voiceoverEnabled: z.boolean().default(false),
  status: VideoScriptStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type VideoScript = z.infer<typeof VideoScriptSchema>;

export type VideoDimensions = {
  width: number;
  height: number;
  label: string;
  ffmpegSize: string;
};

export const VIDEO_PLATFORM_DIMENSIONS: Record<VideoPlatform, VideoDimensions> = {
  tiktok:           { width: 1080, height: 1920, label: "TikTok",            ffmpegSize: "1080x1920" },
  reels:            { width: 1080, height: 1920, label: "Instagram Reels",   ffmpegSize: "1080x1920" },
  shorts:           { width: 1080, height: 1920, label: "YouTube Shorts",    ffmpegSize: "1080x1920" },
  generic_vertical: { width: 1080, height: 1920, label: "Vertical Video",    ffmpegSize: "1080x1920" },
  generic_landscape:{ width: 1920, height: 1080, label: "Landscape Video",   ffmpegSize: "1920x1080" },
};

export function getVideoDimensions(platform: VideoPlatform): VideoDimensions {
  return VIDEO_PLATFORM_DIMENSIONS[platform];
}

export function networkToVideoPlatform(network: string | null | undefined): VideoPlatform {
  switch (network?.toLowerCase()) {
    case "tiktok":    return "tiktok";
    case "instagram": return "reels";
    case "youtube":   return "shorts";
    default:          return "generic_vertical";
  }
}
