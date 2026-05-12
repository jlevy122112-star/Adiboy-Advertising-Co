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
import { persistScheduleEntryPublishOutcome } from "../db/schedule-entry.js";
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

/** Machine-readable validation rows for worker / HTTP clients (Zod-safeParse). */
export type InternalPublishValidationIssue = {
  readonly path: string;
  readonly message: string;
  readonly code: string;
};

function validationIssuesFromZodError(err: z.ZodError): InternalPublishValidationIssue[] {
  return err.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.map(String).join(".") : "(root)",
    message: issue.message,
    code: String(issue.code),
  }));
}

/**
 * Loads schedule + credentials, runs network dispatch, then best-effort syncs
 * `schedule_entries.status` in Postgres when `DATABASE_URL` is set.
 */
export async function runPublishForScheduleEntry(
  payload: PublishJobPayload,
  context: PublishRunnerContext,
): Promise<PublishJobResult> {
  const result = await dispatchPublishByNetwork(payload, context);
  await persistScheduleEntryPublishOutcome(payload, result);
  return result;
}

export async function executeInternalPublish(
  body: unknown,
): Promise<
  | { ok: true; result: PublishJobResult }
  | {
      ok: false;
      status: 400;
      message: string;
      issues: InternalPublishValidationIssue[];
    }
> {
  const parsed = InternalPublishExecuteBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      message: parsed.error.message,
      issues: validationIssuesFromZodError(parsed.error),
    };
  }
  const { payload, context } = parsed.data;
  const result = await runPublishForScheduleEntry(payload, context);
  return { ok: true, result };
}

/** JSON contract for `POST` worker calls (mirrors `internal-publish-server` 200/400 bodies). */
export type InternalPublishHttpResponse =
  | { status: 200; body: PublishJobResult }
  | {
      status: 400;
      body: {
        error: "validation_error";
        message: string;
        issues: InternalPublishValidationIssue[];
      };
    };

export async function executeInternalPublishHttp(
  body: unknown,
): Promise<InternalPublishHttpResponse> {
  const outcome = await executeInternalPublish(body);
  if (!outcome.ok) {
    return {
      status: 400,
      body: {
        error: "validation_error",
        message: outcome.message,
        issues: outcome.issues,
      },
    };
  }
  return { status: 200, body: outcome.result };
}
