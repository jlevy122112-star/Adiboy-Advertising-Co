import { describe, expect, it, vi } from "vitest";
import { PUBLISH_QUEUE_NAME } from "@home-link/marketer-pro-queue";
import { executeSchedulePublishRequest } from "./schedule-publish-route.js";
import type {
  PublishScheduler,
  ScheduledPublishJob,
} from "./schedule-publish.js";

function makeSchedulerStub(
  result: ScheduledPublishJob = {
    jobId: "stub-job-id",
    queueName: PUBLISH_QUEUE_NAME,
  },
) {
  const schedulePublish = vi
    .fn<PublishScheduler["schedulePublish"]>()
    .mockResolvedValue(result);
  const close = vi.fn<PublishScheduler["close"]>().mockResolvedValue();
  const scheduler: PublishScheduler = { schedulePublish, close };
  return { scheduler, schedulePublish, close };
}

describe("executeSchedulePublishRequest", () => {
  it("dispatches a valid body to the scheduler and returns the job ref", async () => {
    const { scheduler, schedulePublish } = makeSchedulerStub();

    const outcome = await executeSchedulePublishRequest(
      {
        scheduleEntryId: "sched-1",
        tenantId: "tenant-1",
        idempotencyKey: "idem-1",
        correlationId: "corr-1",
        network: "meta",
      },
      scheduler,
    );

    expect(outcome).toEqual({
      ok: true,
      result: {
        jobId: "stub-job-id",
        queueName: PUBLISH_QUEUE_NAME,
      },
    });

    expect(schedulePublish).toHaveBeenCalledTimes(1);
    expect(schedulePublish).toHaveBeenCalledWith({
      scheduleEntryId: "sched-1",
      tenantId: "tenant-1",
      idempotencyKey: "idem-1",
      correlationId: "corr-1",
      network: "meta",
      jobOptions: undefined,
    });
  });

  it("forwards the whitelisted jobOptions subset to the scheduler", async () => {
    const { scheduler, schedulePublish } = makeSchedulerStub();

    await executeSchedulePublishRequest(
      {
        scheduleEntryId: "sched-2",
        tenantId: "tenant-2",
        jobOptions: {
          priority: 5,
          delay: 10_000,
          jobId: "explicit-id",
        },
      },
      scheduler,
    );

    expect(schedulePublish).toHaveBeenCalledWith({
      scheduleEntryId: "sched-2",
      tenantId: "tenant-2",
      jobOptions: {
        priority: 5,
        delay: 10_000,
        jobId: "explicit-id",
      },
    });
  });

  it("returns 400 when the body is missing required fields and never calls the scheduler", async () => {
    const { scheduler, schedulePublish } = makeSchedulerStub();

    const outcome = await executeSchedulePublishRequest(
      { scheduleEntryId: "only-this" },
      scheduler,
    );

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.status).toBe(400);
      expect(outcome.message).toMatch(/tenantId/i);
    }
    expect(schedulePublish).not.toHaveBeenCalled();
  });

  it("rejects unknown jobOptions fields (strict subset only)", async () => {
    const { scheduler, schedulePublish } = makeSchedulerStub();

    const outcome = await executeSchedulePublishRequest(
      {
        scheduleEntryId: "sched-3",
        tenantId: "tenant-3",
        jobOptions: {
          /** Not in the strict allowlist — broker internals like
           * `removeOnComplete` are intentionally rejected. */
          removeOnComplete: { age: 60 },
        },
      },
      scheduler,
    );

    expect(outcome.ok).toBe(false);
    expect(schedulePublish).not.toHaveBeenCalled();
  });

  it("propagates errors from the scheduler so the caller can return 5xx", async () => {
    const { scheduler } = makeSchedulerStub();
    vi.mocked(scheduler.schedulePublish).mockRejectedValueOnce(
      new Error("redis_unavailable"),
    );

    await expect(
      executeSchedulePublishRequest(
        { scheduleEntryId: "sched-4", tenantId: "tenant-4" },
        scheduler,
      ),
    ).rejects.toThrow(/redis_unavailable/);
  });
});
