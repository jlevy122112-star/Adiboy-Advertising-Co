import { CopyDirectivesSchema } from "@home-link/marketer-pro-contract";
import { z } from "zod";

/** Payload for a single publish attempt (enqueue from API / scheduler). */
export const PublishJobPayloadSchema = z.object({
  /** Stable reference to the schedule row driving this publish. */
  scheduleEntryId: z.string().min(1),
  /** Tenant / workspace scope for isolation and auditing. */
  tenantId: z.string().min(1),
  /** Optional dedupe key — passed through as BullMQ `jobId` when present. */
  idempotencyKey: z.string().min(1).optional(),
  /** Provider hint — see `classifyPublishNetwork` / `PUBLISH_NETWORK_SLUGS`. Unknown → generic route. */
  network: z.string().min(1).optional(),
  /** Opaque correlation for logs (request id, trace id). */
  correlationId: z.string().min(1).optional(),
  /**
   * Optional canonical copy to adapt for the target network before SDK publish.
   * When set, the worker may run `adaptCopyToPlatform` from `@home-link/marketer-pro-contract`.
   */
  copy: CopyDirectivesSchema.optional(),
});

export type PublishJobPayload = z.infer<typeof PublishJobPayloadSchema>;

export const PublishJobResultSchema = z.object({
  ok: z.boolean(),
  detail: z.string().optional(),
  externalId: z.string().optional(),
});

export type PublishJobResult = z.infer<typeof PublishJobResultSchema>;
