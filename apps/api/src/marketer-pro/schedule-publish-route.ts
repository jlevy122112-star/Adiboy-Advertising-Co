/**
 * Producer-facing publish-schedule route — call this from any external trigger
 * (HTTP route, RPC, dev REPL) that wants to enqueue a `marketer-publish` job.
 *
 * Pairs with {@link executeInternalPublish} on the worker side: the scheduler
 * pushes a job, the worker pulls it, the worker POSTs to
 * `/internal/publish/execute`, and the API runs the actual publish there.
 *
 * Replace `runPublishForScheduleEntry` (in `publish-execute.ts`) with the real
 * social-network call once SDK + DB load are in place — this file does not
 * need to change.
 */

import { z } from "zod";
import {
  PUBLISH_QUEUE_NAME,
  PublishJobPayloadSchema,
} from "@home-link/marketer-pro-queue";
import type { PublishScheduler } from "./schedule-publish.js";

/**
 * Subset of BullMQ `JobsOptions` we expose over the wire — keep this tight so
 * external callers can't reach into broker internals (rate limits, locks,
 * removeOnComplete, etc.). Add fields only when there's a concrete use case.
 */
export const SchedulePublishJobOptionsSchema = z
  .object({
    priority: z.number().int().nonnegative().optional(),
    delay: z.number().int().nonnegative().optional(),
    jobId: z.string().min(1).optional(),
  })
  .strict();

export type SchedulePublishJobOptions = z.infer<
  typeof SchedulePublishJobOptionsSchema
>;

export const SchedulePublishRequestBodySchema = PublishJobPayloadSchema.extend({
  jobOptions: SchedulePublishJobOptionsSchema.optional(),
});

export type SchedulePublishRequestBody = z.infer<
  typeof SchedulePublishRequestBodySchema
>;

export interface SchedulePublishSuccess {
  readonly ok: true;
  readonly result: {
    readonly jobId: string | undefined;
    readonly queueName: typeof PUBLISH_QUEUE_NAME;
  };
}

export interface SchedulePublishValidationError {
  readonly ok: false;
  readonly status: 400;
  readonly message: string;
}

export type SchedulePublishOutcome =
  | SchedulePublishSuccess
  | SchedulePublishValidationError;

/**
 * Validate, dispatch, and return a typed outcome. Caller (HTTP server, RPC,
 * test) is responsible for translating the outcome into the wire format.
 *
 * Throws only when the underlying scheduler/broker call fails — surface those
 * as 5xx in the transport layer so retries / alerting kick in.
 */
export async function executeSchedulePublishRequest(
  body: unknown,
  scheduler: PublishScheduler,
): Promise<SchedulePublishOutcome> {
  const parsed = SchedulePublishRequestBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      message: parsed.error.message,
    };
  }
  const { jobOptions, ...payload } = parsed.data;
  const scheduled = await scheduler.schedulePublish({
    ...payload,
    jobOptions,
  });
  return {
    ok: true,
    result: {
      jobId: scheduled.jobId,
      queueName: scheduled.queueName,
    },
  };
}
