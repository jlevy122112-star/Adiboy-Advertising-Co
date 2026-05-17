/**
 * Phase 15 — Content safety, compliance, and anomaly detection contracts.
 */

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/*                          Scan types & severity                             */
/* -------------------------------------------------------------------------- */

export const CONTENT_SCAN_TYPES = [
  "claim_detection",
  "pii_detection",
  "brand_safety",
  "regulated_content",
  "copyright",
] as const;
export const ContentScanTypeSchema = z.enum(CONTENT_SCAN_TYPES);
export type ContentScanType = z.infer<typeof ContentScanTypeSchema>;

export const SCAN_SEVERITIES = ["clean", "low", "medium", "high", "critical"] as const;
export const ScanSeveritySchema = z.enum(SCAN_SEVERITIES);
export type ScanSeverity = z.infer<typeof ScanSeveritySchema>;

export function maxSeverity(severities: ScanSeverity[]): ScanSeverity {
  const order: ScanSeverity[] = ["clean", "low", "medium", "high", "critical"];
  let max = 0;
  for (const s of severities) {
    const idx = order.indexOf(s);
    if (idx > max) max = idx;
  }
  return order[max]!;
}

export function severityPasses(s: ScanSeverity): boolean {
  return s === "clean" || s === "low";
}

/* -------------------------------------------------------------------------- */
/*                          Findings                                          */
/* -------------------------------------------------------------------------- */

export const ScanFindingSchema = z.object({
  type: ContentScanTypeSchema,
  severity: ScanSeveritySchema,
  code: z.string().min(1).max(80),
  message: z.string().max(500),
  snippet: z.string().max(300).nullable(),
  offset: z.number().int().min(0).nullable(),
  suggestion: z.string().max(500).nullable(),
}).strict();
export type ScanFinding = z.infer<typeof ScanFindingSchema>;

/* -------------------------------------------------------------------------- */
/*                          Scan result                                       */
/* -------------------------------------------------------------------------- */

export const ContentScanResultSchema = z.object({
  id: z.string().min(1).max(120),
  workspaceId: z.string().min(1).max(120),
  entityType: z.string().max(60).nullable(),
  entityId: z.string().max(120).nullable(),
  scannedText: z.string().max(10_000),
  contentTypes: z.array(ContentScanTypeSchema),
  findings: z.array(ScanFindingSchema).max(200),
  overallSeverity: ScanSeveritySchema,
  passed: z.boolean(),
  remediatedText: z.string().max(10_000).nullable(),
  scannedAt: z.string().datetime(),
}).strict();
export type ContentScanResult = z.infer<typeof ContentScanResultSchema>;

export const ScanRequestSchema = z.object({
  text: z.string().min(1).max(10_000),
  entityType: z.string().max(60).optional(),
  entityId: z.string().max(120).optional(),
  contentTypes: z.array(ContentScanTypeSchema).optional(),
  network: z.string().max(60).optional(),
  autoRemediate: z.boolean().optional(),
}).strict();
export type ScanRequest = z.infer<typeof ScanRequestSchema>;

/* -------------------------------------------------------------------------- */
/*                          Anomaly detection                                 */
/* -------------------------------------------------------------------------- */

export const ANOMALY_TYPES = [
  "publish_volume_spike",
  "off_hours_activity",
  "token_revocation",
  "rapid_fail_sequence",
  "account_takeover_signal",
  "unusual_network_pattern",
] as const;
export const AnomalyTypeSchema = z.enum(ANOMALY_TYPES);
export type AnomalyType = z.infer<typeof AnomalyTypeSchema>;

export const AnomalyEventSchema = z.object({
  id: z.string().min(1).max(120),
  workspaceId: z.string().min(1).max(120),
  type: AnomalyTypeSchema,
  severity: ScanSeveritySchema,
  description: z.string().max(1000),
  metadata: z.record(z.string(), z.unknown()),
  acknowledgedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
}).strict();
export type AnomalyEvent = z.infer<typeof AnomalyEventSchema>;

/* -------------------------------------------------------------------------- */
/*                          Account deletion (GDPR)                          */
/* -------------------------------------------------------------------------- */

export const DELETION_STATUSES = ["requested", "in_progress", "completed", "failed"] as const;
export const DeletionStatusSchema = z.enum(DELETION_STATUSES);
export type DeletionStatus = z.infer<typeof DeletionStatusSchema>;

export const AccountDeletionRequestSchema = z.object({
  id: z.string().min(1).max(120),
  workspaceId: z.string().min(1).max(120),
  requestedByUserId: z.string().min(1).max(120),
  reason: z.string().max(2000).nullable(),
  status: DeletionStatusSchema,
  scheduledAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();
export type AccountDeletionRequest = z.infer<typeof AccountDeletionRequestSchema>;

export const RequestDeletionBodySchema = z.object({
  reason: z.string().max(2000).optional(),
  scheduleDelayHours: z.number().int().min(0).max(720).optional(),
}).strict();
export type RequestDeletionBody = z.infer<typeof RequestDeletionBodySchema>;
