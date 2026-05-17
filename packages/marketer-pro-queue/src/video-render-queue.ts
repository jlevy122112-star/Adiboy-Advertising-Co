import { Job, Queue, Worker, type JobsOptions, type Processor, type WorkerOptions } from "bullmq";
import type { Redis } from "ioredis";
import {
  type VideoRenderJobPayload,
  type VideoRenderJobResult,
  VideoRenderJobPayloadSchema,
  VideoRenderJobResultSchema,
} from "./video-render-job.js";

export const VIDEO_RENDER_QUEUE_NAME = "marketer-video-render";

export function defaultVideoRenderJobOptions(): JobsOptions {
  return {
    attempts: Number(process.env.MARKETER_VIDEO_RENDER_JOB_ATTEMPTS ?? 3),
    backoff: { type: "exponential", delay: Number(process.env.MARKETER_VIDEO_RENDER_BACKOFF_MS ?? 5000) },
    removeOnComplete: { age: 48 * 3600, count: 500 },
    removeOnFail: { age: 7 * 24 * 3600, count: 2000 },
  };
}

export function createVideoRenderQueue(connection: Redis): Queue<VideoRenderJobPayload> {
  return new Queue<VideoRenderJobPayload>(VIDEO_RENDER_QUEUE_NAME, { connection });
}

export async function enqueueVideoRenderJob(
  queue: Queue<VideoRenderJobPayload>,
  payload: VideoRenderJobPayload,
): Promise<Job<VideoRenderJobPayload>> {
  const validated = VideoRenderJobPayloadSchema.parse(payload);
  return queue.add("video-render", validated, {
    ...defaultVideoRenderJobOptions(),
    jobId: `video-render:${payload.tenantId}:${payload.jobId}`,
  });
}

export type VideoRenderProcessor = (job: Job<VideoRenderJobPayload>) => Promise<VideoRenderJobResult>;

export type CreateVideoRenderWorkerOptions = Omit<WorkerOptions, "connection"> & { queueName?: string };

export function createVideoRenderWorker(
  connection: Redis,
  processor: VideoRenderProcessor,
  options: CreateVideoRenderWorkerOptions = {},
): Worker<VideoRenderJobPayload, VideoRenderJobResult> {
  const { concurrency, queueName, ...rest } = options;
  const bullProcessor: Processor<VideoRenderJobPayload, VideoRenderJobResult> = async (job) => {
    const result = await processor(job);
    return VideoRenderJobResultSchema.parse(result);
  };
  return new Worker<VideoRenderJobPayload, VideoRenderJobResult>(
    queueName ?? VIDEO_RENDER_QUEUE_NAME,
    bullProcessor,
    {
      connection,
      concurrency: concurrency ?? Number(process.env.MARKETER_VIDEO_RENDER_CONCURRENCY ?? 2),
      autorun: true,
      ...rest,
    },
  );
}
