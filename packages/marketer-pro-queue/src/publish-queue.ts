import { Job, Queue, type JobsOptions } from "bullmq";
import type { Redis } from "ioredis";
import {
  type PublishJobPayload,
  PublishJobPayloadSchema,
} from "./publish-job.js";

export const PUBLISH_QUEUE_NAME = "marketer-publish";

/** Default producer-side reliability settings — tune per environment. */
export function defaultPublishJobOptions(): JobsOptions {
  return {
    attempts: Number(process.env.MARKETER_PUBLISH_JOB_ATTEMPTS ?? 5),
    backoff: {
      type: "exponential",
      delay: Number(process.env.MARKETER_PUBLISH_BACKOFF_MS ?? 2000),
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
      count: 5000,
    },
  };
}

export function createPublishQueue(connection: Redis): Queue<PublishJobPayload> {
  return new Queue<PublishJobPayload>(PUBLISH_QUEUE_NAME, {
    connection,
    defaultJobOptions: defaultPublishJobOptions(),
  });
}

export async function enqueuePublishJob(
  queue: Queue<PublishJobPayload>,
  raw: unknown,
  jobOptions?: JobsOptions,
): Promise<Job<PublishJobPayload>> {
  const data = PublishJobPayloadSchema.parse(raw);
  const merged: JobsOptions = {
    ...defaultPublishJobOptions(),
    ...jobOptions,
    jobId: jobOptions?.jobId ?? data.idempotencyKey,
  };
  return queue.add("publish", data, merged);
}
