import { z } from "zod";

export const SentimentScoreSchema = z.enum(["positive", "negative", "neutral", "mixed"]);
export type SentimentScore = z.infer<typeof SentimentScoreSchema>;

export const BrandSafetyFlagSchema = z.enum([
  "hate_speech",
  "misinformation",
  "spam",
  "competitor_attack",
  "pii_exposure",
  "inappropriate_content",
  "legal_risk",
]);
export type BrandSafetyFlag = z.infer<typeof BrandSafetyFlagSchema>;

export const SocialCommentSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  scheduleEntryId: z.string(),
  network: z.string(),
  externalCommentId: z.string(),
  authorName: z.string().optional(),
  authorId: z.string().optional(),
  body: z.string(),
  likeCount: z.number().int().nullable(),
  replyCount: z.number().int().nullable(),
  postedAt: z.string().datetime().nullable(),
  sentimentScore: SentimentScoreSchema.nullable(),
  sentimentConfidence: z.number().min(0).max(1).nullable(),
  topics: z.array(z.string()),
  isNegativeSignal: z.boolean(),
  brandSafetyFlags: z.array(BrandSafetyFlagSchema),
  suggestedResponse: z.string().nullable(),
  fedToMemory: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SocialComment = z.infer<typeof SocialCommentSchema>;

export const SentimentSummarySchema = z.object({
  tenantId: z.string(),
  scheduleEntryId: z.string().nullable(),
  network: z.string().nullable(),
  totalComments: z.number().int(),
  positiveCount: z.number().int(),
  negativeCount: z.number().int(),
  neutralCount: z.number().int(),
  mixedCount: z.number().int(),
  negativeSignalCount: z.number().int(),
  brandSafetyFlagCount: z.number().int(),
  avgConfidence: z.number(),
  topTopics: z.array(z.object({ topic: z.string(), count: z.number().int() })),
  overallSentiment: SentimentScoreSchema.nullable(),
});
export type SentimentSummary = z.infer<typeof SentimentSummarySchema>;

export const SentimentAnalysisSchema = z.object({
  score: SentimentScoreSchema,
  confidence: z.number().min(0).max(1),
  topics: z.array(z.string()).max(5),
  isNegativeSignal: z.boolean(),
  brandSafetyFlags: z.array(BrandSafetyFlagSchema),
  suggestedResponse: z.string().nullable(),
});
export type SentimentAnalysis = z.infer<typeof SentimentAnalysisSchema>;
