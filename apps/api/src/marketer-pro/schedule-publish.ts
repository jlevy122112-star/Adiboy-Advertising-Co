/**
 * Scheduler boundary — call this from the publish endpoint / cron to enqueue
 * a `marketer-publish` job onto the BullMQ queue managed in
 * `@home-link/marketer-pro-queue`.
 *
 * STATUS: scaffold. `apps/api` is currently a hollow shell (no
 * `package.json`/`tsconfig.json`); this module activates once the API package
 * is restored to the workspace. It compiles untouched as soon as the package
 * gets `@home-link/marketer-pro-queue` as a dependency.
 *
 * Why a thin shim?
 * - `apps/api` should not import `bullmq` / `ioredis` directly. The queue
 *   package owns connection options (BullMQ requires
 *   `maxRetriesPerRequest: null`) and retry/backoff defaults.
 * - This file is the *only* producer-side surface the rest of the API talks
 *   to, so swapping the broker (or short-circuiting in tests) stays a single
 *   edit.
 *
 * Usage:
 *
 *   const scheduler = createPublishScheduler();
 *   await scheduler.schedulePublish({
 *     scheduleEntryId,
 *     tenantId,
 *     idempotencyKey: `publish:${scheduleEntryId}:${slotStart.toISOString()}`,
 *   });
 *   // …on shutdown:
 *   await scheduler.close();
 */

import {
  createPublishQueue,
  createRedisConnection,
  enqueuePublishJob,
  PUBLISH_QUEUE_NAME,
  type PublishJobPayload,
} from "@home-link/marketer-pro-queue";
import type { JobsOptions, Queue } from "bullmq";
import type { Redis } from "ioredis";

export interface SchedulePublishInput
  extends Omit<PublishJobPayload, "idempotencyKey" | "correlationId"> {
  /**
   * Optional dedupe key — recommended pattern:
   * `publish:${scheduleEntryId}:${slotStart.toISOString()}` to keep retries of
   * the same slot from spawning duplicate publishes.
   */
  readonly idempotencyKey?: string;
  /** Request id / trace id to pass through to worker logs. */
  readonly correlationId?: string;
  /** Per-call overrides — falls back to `defaultPublishJobOptions()`. */
  readonly jobOptions?: JobsOptions;
}

export interface ScheduledPublishJob {
  readonly jobId: string | undefined;
  readonly queueName: typeof PUBLISH_QUEUE_NAME;
}

export interface PublishScheduler {
  schedulePublish(input: SchedulePublishInput): Promise<ScheduledPublishJob>;
  /**
   * Releases the underlying Queue + Redis connection. Call once on graceful
   * shutdown of the API process.
   */
  close(): Promise<void>;
}

export interface PublishSchedulerOptions {
  /**
   * Reuse an existing Redis connection (e.g. one shared with rate limiters
   * elsewhere in the API). If omitted, a dedicated connection is created via
   * `createRedisConnection()` and closed on `scheduler.close()`.
   */
  readonly connection?: Redis;
  /**
   * Override the Queue used to publish jobs. Useful in tests where you want
   * to stub out the broker entirely.
   */
  readonly queue?: Queue<PublishJobPayload>;
}

/**
 * Build a `PublishScheduler`. The returned instance owns its Redis
 * connection only when one was not supplied — callers that pass `connection`
 * are responsible for closing it.
 */
export function createPublishScheduler(
  options: PublishSchedulerOptions = {},
): PublishScheduler {
  const ownsConnection = options.connection === undefined;
  const connection = options.connection ?? createRedisConnection();
  const queue =
    options.queue ?? createPublishQueue(connection);

  return {
    async schedulePublish(input): Promise<ScheduledPublishJob> {
      const { jobOptions, ...payload } = input;
      const job = await enqueuePublishJob(queue, payload, jobOptions);
      return {
        jobId: job.id,
        queueName: PUBLISH_QUEUE_NAME,
      };
    },

    async close(): Promise<void> {
      if (options.queue === undefined) {
        await queue.close();
      }
      if (ownsConnection) {
        await connection.quit().catch(() => {
          /** `quit` can reject if the connection already dropped — safe to ignore. */
        });
      }
    },
  };
}
