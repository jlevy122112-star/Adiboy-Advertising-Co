import { z } from "zod";

export const DayOfWeekSchema = z.number().int().min(0).max(6);

export const ConfidenceLevelSchema = z.enum(["low", "medium", "high"]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export const BestTimeSlotSchema = z.object({
  dayOfWeek: DayOfWeekSchema,        // 0=Sun … 6=Sat
  hourUTC: z.number().int().min(0).max(23),
  score: z.number().min(0).max(100), // composite score
  engagementScore: z.number().min(0).max(100),
  reachScore: z.number().min(0).max(100),
  confidence: ConfidenceLevelSchema,
  reasons: z.array(z.string()),      // human-readable signal labels
});
export type BestTimeSlot = z.infer<typeof BestTimeSlotSchema>;

export const ScheduleRecommendationSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  scheduleEntryId: z.string().nullable(),
  network: z.string(),
  contentType: z.string().nullable(),   // "image" | "video" | "text" | "link"
  audienceTimezone: z.string().nullable(),
  topSlots: z.array(BestTimeSlotSchema).max(5),
  appliedSlot: BestTimeSlotSchema.nullable(),
  appliedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type ScheduleRecommendation = z.infer<typeof ScheduleRecommendationSchema>;

export const PredictRequestSchema = z.object({
  scheduleEntryId: z.string().optional(),
  network: z.string(),
  contentType: z.string().optional(),
  audienceTimezone: z.string().optional(),
});
export type PredictRequest = z.infer<typeof PredictRequestSchema>;

// Day labels
export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
