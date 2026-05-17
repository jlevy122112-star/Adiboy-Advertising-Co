/**
 * Phase 9 — SERP-based AI content brief contracts.
 */

import { z } from "zod";

export const SerpResultSchema = z.object({
  position: z.number(),
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
  domain: z.string(),
});
export type SerpResult = z.infer<typeof SerpResultSchema>;

export const KeywordIntentSchema = z.enum([
  "informational",
  "navigational",
  "commercial",
  "transactional",
]);
export type KeywordIntent = z.infer<typeof KeywordIntentSchema>;

export const SerpBriefStatusSchema = z.enum([
  "pending",
  "fetching",
  "analyzing",
  "done",
  "failed",
]);
export type SerpBriefStatus = z.infer<typeof SerpBriefStatusSchema>;

export const ContentGapSchema = z.object({
  topic: z.string(),
  reason: z.string(),
});

export const SerpBriefSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  keyword: z.string(),
  status: SerpBriefStatusSchema,

  // SERP data
  serpResults: z.array(SerpResultSchema).optional(),
  intent: KeywordIntentSchema.optional(),

  // AI analysis
  competitorAngles: z.array(z.string()).optional(),
  contentGaps: z.array(ContentGapSchema).optional(),
  suggestedHeadline: z.string().optional(),
  suggestedAngle: z.string().optional(),
  suggestedOutline: z.array(z.string()).optional(),
  targetKeywords: z.array(z.string()).optional(),
  seoScore: z.number().min(0).max(100).optional(),
  seoScoreReason: z.string().optional(),

  error: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type SerpBrief = z.infer<typeof SerpBriefSchema>;

export const SerpBriefRequestSchema = z.object({
  keyword: z.string().min(1).max(500),
  network: z.string().optional(),
  industryVertical: z.string().optional(),
});
export type SerpBriefRequest = z.infer<typeof SerpBriefRequestSchema>;
