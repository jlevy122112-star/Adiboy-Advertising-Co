/**
 * Worker-facing publish execution — called by `createHttpPublishRunner` POSTs.
 * Replace `runPublishForScheduleEntry` with Meta Graph / X / TikTok calls + DB loads.
 */

import { z } from "zod";
import {
  PublishJobPayloadSchema,
  type PublishJobPayload,
  type PublishJobResult,
} from "@home-link/marketer-pro-queue";
import { dispatchPublishByNetwork } from "./publish-dispatch.js";

export const PublishRunnerContextSchema = z.object({
  jobId: z.string().min(1).optional(),
  /** 1-indexed attempt (matches worker logs). */
  attempt: z.number().int().positive(),
});

export type PublishRunnerContext = z.infer<typeof PublishRunnerContextSchema>;

export const InternalPublishExecuteBodySchema = z.object({
  payload: PublishJobPayloadSchema,
  context: PublishRunnerContextSchema,
});

export type InternalPublishExecuteBody = z.infer<
  typeof InternalPublishExecuteBodySchema
>;

/**
 * Loads schedule + credentials and posts to the social network.
 * Today: structured success placeholder so the HTTP round-trip is fully wired.
 */
export async function runPublishForScheduleEntry(
  payload: PublishJobPayload,
  context: PublishRunnerContext,
): Promise<PublishJobResult> {
  return dispatchPublishByNetwork(payload, context);
}

export async function executeInternalPublish(
  body: unknown,
): Promise<
  | { ok: true; result: PublishJobResult }
  | { ok: false; status: 400; message: string }
> {
  const parsed = InternalPublishExecuteBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      message: parsed.error.message,
    };
  }
  const { payload, context } = parsed.data;
  const result = await runPublishForScheduleEntry(payload, context);
  return { ok: true, result };
}
