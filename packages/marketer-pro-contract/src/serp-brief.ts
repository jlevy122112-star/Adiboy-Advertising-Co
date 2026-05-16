import { z } from "zod";

export const SerpIntentSchema = z.enum([
  "informational",
  "navigational",
  "commercial",
  "transactional",
]);
export type SerpIntent = z.infer<typeof SerpIntentSchema>;

export const SerpResultSchema = z.object({
  rank: z.number().int().min(1),
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
  domain: z.string(),
});
export type SerpResult = z.infer<typeof SerpResultSchema>;

export const ContentGapSchema = z.object({
  topic: z.string(),
  competitorsCovering: z.number().int(),
  opportunity: z.string(),
});
export type ContentGap = z.infer<typeof ContentGapSchema>;

export const SerpBriefStatusSchema = z.enum([
  "pending",
  "fetching",
  "analyzing",
  "ready",
  "failed",
]);
export type SerpBriefStatus = z.infer<typeof SerpBriefStatusSchema>;

export const SerpBriefSchema = z.object({
  briefId: z.string(),
  workspaceId: z.string(),
  keyword: z.string(),
  location: z.string().optional(),
  intent: SerpIntentSchema,
  topResults: z.array(SerpResultSchema),
  competitorSummary: z.string(),
  contentGaps: z.array(ContentGapSchema),
  suggestedAngle: z.string(),
  suggestedHeadline: z.string(),
  suggestedOutline: z.array(z.string()),
  secondaryKeywords: z.array(z.string()),
  seoScore: z.number().min(0).max(100),
  status: SerpBriefStatusSchema,
  error: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SerpBrief = z.infer<typeof SerpBriefSchema>;
