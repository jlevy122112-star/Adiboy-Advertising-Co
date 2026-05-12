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
  PublishJobResultSchema,
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

/** POST JSON body sent by {@link createHttpPublishRunner}. */
export interface HttpPublishRequestBody {
  readonly payload: PublishJobPayload;
  readonly context: PublishRunnerContext;
}

export interface HttpPublishRunnerOptions {
  /** Full URL (e.g. `https://api.example/internal/publish/execute`). */
  readonly url: string;
  /** Override for tests; defaults to `globalThis.fetch`. */
  readonly fetchFn?: typeof fetch;
  /** Request timeout (ms). Env fallback: `MARKETER_PUBLISH_HTTP_TIMEOUT_MS`. */
  readonly timeoutMs?: number;
  /** Extra headers (e.g. auth); merged after `Content-Type`. */
  readonly headers?: Record<string, string>;
}

/**
 * Calls an internal HTTP endpoint that performs the real publish (same code as
 * synchronously invoked from `apps/api`, or a thin relay). The worker POSTs:
 *
 * `{ "payload": PublishJobPayload, "context": PublishRunnerContext }`
 *
 * The response body must be JSON matching {@link PublishJobResult}.
 *
 * - **2xx** + valid JSON → returned as the job result (completed).
 * - **4xx** → `{ ok: false, detail: ... }` without throwing (completed failure; adjust API if retries are desired).
 *   The internal publish server (`apps/api` `executeInternalPublishHttp`) returns **400** with JSON
 *   `{ error: "validation_error", message, issues }`; that payload is embedded in `detail` (truncated) for logs.
 * - **5xx / network / timeout / invalid JSON** → throws so BullMQ can retry.
 */
export function createHttpPublishRunner(
  options: HttpPublishRunnerOptions,
): PublishRunnerWithContext {
  const fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
  const timeoutMs =
    options.timeoutMs ??
    Number(process.env.MARKETER_PUBLISH_HTTP_TIMEOUT_MS ?? 60_000);

  return async (payload, context) => {
    const signal = AbortSignal.timeout(timeoutMs);
    const res = await fetchFn(options.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: JSON.stringify({ payload, context }),
      signal,
    });

    // Read body once — `Response` bodies are single-use streams.
    const text = await res.text();

    if (!res.ok) {
      if (res.status >= 500) {
        throw new Error(`publish_http_upstream_${res.status}`);
      }
      const snippet = text.slice(0, 500);
      return {
        ok: false,
        detail: `publish_http_client_error:${res.status}:${snippet}`,
      };
    }

    if (!text.trim()) {
      return {
        ok: true,
        detail: "publish_http_empty_body",
      };
    }

    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      throw new Error("publish_http_invalid_json_body");
    }

    const parsed = PublishJobResultSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(
        `publish_http_result_invalid: ${parsed.error.message}`,
      );
    }
    return parsed.data;
  };
}

export interface ResolvePublishRunnerFromEnvOptions {
  /** Primarily for tests; production uses `globalThis.fetch`. */
  readonly fetchFn?: typeof fetch;
}

/**
 * **Production worker:** set `MARKETER_PUBLISH_HTTP_URL` to use the HTTP
 * runner; otherwise the stub runner is used (local dev without an API).
 *
 * Optional `MARKETER_PUBLISH_HTTP_TOKEN`: when non-empty, sends
 * `Authorization: Bearer <token>`.
 */
export function resolvePublishRunnerFromEnv(
  options: ResolvePublishRunnerFromEnvOptions = {},
): PublishRunnerWithContext {
  const url = process.env.MARKETER_PUBLISH_HTTP_URL?.trim();
  if (url) {
    const token = process.env.MARKETER_PUBLISH_HTTP_TOKEN?.trim();
    return createHttpPublishRunner({
      url,
      fetchFn: options.fetchFn,
      headers:
        token !== undefined && token.length > 0
          ? { Authorization: `Bearer ${token}` }
          : undefined,
    });
  }
  return createStubPublishRunner();
}
