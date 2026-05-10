import type { Queue } from "bullmq";
import { describe, expect, it, vi } from "vitest";
import type { PublishJobPayload } from "./publish-job.js";
import { enqueuePublishJob } from "./publish-queue.js";

describe("enqueuePublishJob", () => {
  const basePayload = {
    scheduleEntryId: "sched-1",
    tenantId: "tenant-1",
  };

  it("uses explicit jobId over payload idempotencyKey", async () => {
    const add = vi.fn().mockResolvedValue({});
    const queue = { add } as unknown as Queue<PublishJobPayload>;

    await enqueuePublishJob(queue, {
      ...basePayload,
      idempotencyKey: "idem-from-payload",
    }, { jobId: "caller-chosen-id" });

    expect(add).toHaveBeenCalledWith(
      "publish",
      expect.objectContaining({ idempotencyKey: "idem-from-payload" }),
      expect.objectContaining({ jobId: "caller-chosen-id" }),
    );
  });

  it("falls back to idempotencyKey when jobOptions.jobId is omitted", async () => {
    const add = vi.fn().mockResolvedValue({});
    const queue = { add } as unknown as Queue<PublishJobPayload>;

    await enqueuePublishJob(queue, {
      ...basePayload,
      idempotencyKey: "idem-only",
    });

    expect(add).toHaveBeenCalledWith(
      "publish",
      expect.any(Object),
      expect.objectContaining({ jobId: "idem-only" }),
    );
  });
});
