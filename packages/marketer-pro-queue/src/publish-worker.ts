import {
  type Job,
  Worker,
  type Processor,
  type WorkerOptions,
} from "bullmq";
import type { Redis } from "ioredis";
import {
  type PublishJobPayload,
  type PublishJobResult,
  PublishJobResultSchema,
} from "./publish-job.js";
import { PUBLISH_QUEUE_NAME } from "./publish-queue.js";

export type PublishProcessor = (
  job: Job<PublishJobPayload>,
) => Promise<PublishJobResult>;

/** BullMQ `Worker` options plus an optional queue name (defaults to {@link PUBLISH_QUEUE_NAME}). */
export type CreatePublishWorkerOptions = Omit<WorkerOptions, "connection"> & {
  queueName?: string;
};

const defaultConcurrency = () =>
  Number(process.env.MARKETER_PUBLISH_WORKER_CONCURRENCY ?? 5);

export function createPublishWorker(
  connection: Redis,
  processor: PublishProcessor,
  options: CreatePublishWorkerOptions = {},
): Worker<PublishJobPayload, PublishJobResult> {
  const { concurrency, queueName, ...workerRest } = options;
  const bullProcessor: Processor<PublishJobPayload, PublishJobResult> = async (
    job,
  ) => {
    const result = await processor(job);
    return PublishJobResultSchema.parse(result);
  };

  return new Worker<PublishJobPayload, PublishJobResult>(
    queueName ?? PUBLISH_QUEUE_NAME,
    bullProcessor,
    {
      connection,
      concurrency: concurrency ?? defaultConcurrency(),
      autorun: true,
      ...workerRest,
    },
  );
}
