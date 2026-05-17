import { z } from "zod";

export const VideoRenderJobPayloadSchema = z.object({
  scriptId: z.string().min(1),
  jobId: z.string().min(1),
  tenantId: z.string().min(1),
  voiceover: z.boolean().default(false),
  network: z.string().optional(),
});

export type VideoRenderJobPayload = z.infer<typeof VideoRenderJobPayloadSchema>;

export const VideoRenderJobResultSchema = z.object({
  ok: z.boolean(),
  url: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  durationS: z.number().optional(),
  error: z.string().optional(),
});

export type VideoRenderJobResult = z.infer<typeof VideoRenderJobResultSchema>;
