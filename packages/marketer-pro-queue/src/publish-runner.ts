/**
 * Publish runner — the work performed for each `marketer-publish` job.
 *
 * Lives in `@home-link/marketer-pro-queue` (no `bullmq` import) so it can be
 * shared between the worker process (`worker-cli.ts`) and any in-process
 * caller in `apps/api` that wants to short-circuit a publish for testing or
 * dev mode without going through Redis.
 *
 * Replace `createStubPublishRunner()` with a real implementation that calls
 * the publisher (Meta Graph, X API, …) once `apps/api` exposes a shared
 * publish module or internal HTTP endpoint.
 */

import {
  type PublishJobPayload,
  type PublishJobResult,
} from "./publish-job.js";

/** A single attempt at publishing one schedule entry to one network. */
export type PublishRunner = (
  payload: PublishJobPayload,
) => Promise<PublishJobResult>;

/** Optional context surfaced to runners (job id, retry count, logger hook). */
export interface PublishRunnerContext {
  readonly jobId: string | undefined;
  /** 1-indexed attempt number (matches user-facing logs and dashboards). */
  readonly attempt: number;
}

/**
 * Runner that accepts the BullMQ-style context. The `worker-cli` adapts a
 * BullMQ `Job` into this shape so runners stay framework-agnostic.
 */
export type PublishRunnerWithContext = (
  payload: PublishJobPayload,
  context: PublishRunnerContext,
) => Promise<PublishJobResult>;

export interface StubPublishRunnerOptions {
  /** Override the default `detail` for the stub response. Useful in tests. */
  readonly detail?: string;
  /** Hook for asserting the runner was called (tests + local dev). */
  readonly onCall?: (
    payload: PublishJobPayload,
    context: PublishRunnerContext,
  ) => void;
}

export const STUB_PUBLISH_RUNNER_DETAIL =
  "stub_publish_processor_replace_with_api_call";

/**
 * Default stub runner — succeeds with a clearly-marked detail string so
 * downstream observers know the publish path is not yet wired to a real API.
 */
export function createStubPublishRunner(
  options: StubPublishRunnerOptions = {},
): PublishRunnerWithContext {
  const { detail = STUB_PUBLISH_RUNNER_DETAIL, onCall } = options;
  return async (payload, context) => {
    onCall?.(payload, context);
    return {
      ok: true,
      detail,
    };
  };
}

/**
 * Adapt a context-aware runner into the simpler `PublishRunner` shape (no
 * context). Use when you want to pass a runner to a caller that does not have
 * job metadata (e.g. an inline call from `apps/api` for dev-mode publishing).
 */
export function withoutContext(
  runner: PublishRunnerWithContext,
): PublishRunner {
  return (payload) =>
    runner(payload, { jobId: undefined, attempt: 1 });
}
