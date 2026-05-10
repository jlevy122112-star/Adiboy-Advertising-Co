import type { PublishJobPayload } from "@home-link/marketer-pro-queue";
import type { JobsOptions, Queue } from "bullmq";
import type { Redis } from "ioredis";
import { afterEach, describe, expect, it, vi } from "vitest";

const queueClose = vi.fn<() => Promise<void>>().mockResolvedValue();
const queueAdd = vi
  .fn<
    (
      name: string,
      data: unknown,
      opts?: JobsOptions,
    ) => Promise<{ id: string | undefined; name: string }>
  >()
  .mockImplementation(async (name, _data, opts) => ({
    id: opts?.jobId ?? "generated-id",
    name,
  }));
const connectionQuit = vi.fn<() => Promise<"OK">>().mockResolvedValue("OK");

/**
 * Mock the queue package so `createPublishScheduler` builds its internal
 * Queue and Redis from spies we control, with no real network I/O.
 *
 * `vi.mock` is hoisted above the import of the SUT, so the scheduler picks up
 * these factories.
 */
vi.mock("@home-link/marketer-pro-queue", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@home-link/marketer-pro-queue")>();
  return {
    ...actual,
    createRedisConnection: vi.fn(
      () => ({ quit: connectionQuit }) as unknown as Redis,
    ),
    createPublishQueue: vi.fn(
      () =>
        ({
          add: queueAdd,
          close: queueClose,
        }) as unknown as Queue<PublishJobPayload>,
    ),
  };
});

const { PUBLISH_QUEUE_NAME, createPublishQueue, createRedisConnection } =
  await import("@home-link/marketer-pro-queue");
const { createPublishScheduler } = await import("./schedule-publish.js");

const basePayload = {
  scheduleEntryId: "sched-1",
  tenantId: "tenant-1",
} as const;

describe("createPublishScheduler", () => {
  afterEach(() => {
    queueClose.mockClear();
    queueAdd.mockClear();
    connectionQuit.mockClear();
    vi.mocked(createPublishQueue).mockClear();
    vi.mocked(createRedisConnection).mockClear();
  });

  it("schedulePublish forwards to enqueuePublishJob and returns jobId + queueName", async () => {
    const scheduler = createPublishScheduler();

    const result = await scheduler.schedulePublish({
      ...basePayload,
      idempotencyKey: "idem-1",
      correlationId: "corr-1",
    });

    expect(result).toEqual({
      jobId: "idem-1",
      queueName: PUBLISH_QUEUE_NAME,
    });

    expect(queueAdd).toHaveBeenCalledTimes(1);
    const [, dataArg, optsArg] = queueAdd.mock.calls[0] ?? [];
    expect(dataArg).toMatchObject({
      scheduleEntryId: "sched-1",
      tenantId: "tenant-1",
      idempotencyKey: "idem-1",
      correlationId: "corr-1",
    });
    expect(optsArg).toMatchObject({ jobId: "idem-1" });
  });

  it("forwards per-call jobOptions overrides to BullMQ", async () => {
    const scheduler = createPublishScheduler();

    await scheduler.schedulePublish({
      ...basePayload,
      jobOptions: { priority: 7, jobId: "explicit-id" },
    });

    const [, , optsArg] = queueAdd.mock.calls[0] ?? [];
    expect(optsArg).toMatchObject({ priority: 7, jobId: "explicit-id" });
  });

  it("close() closes the queue and quits the connection when neither was injected", async () => {
    const scheduler = createPublishScheduler();
    expect(createPublishQueue).toHaveBeenCalledTimes(1);
    expect(createRedisConnection).toHaveBeenCalledTimes(1);

    await scheduler.close();

    expect(queueClose).toHaveBeenCalledTimes(1);
    expect(connectionQuit).toHaveBeenCalledTimes(1);
  });

  it("close() does NOT close an externally-supplied queue", async () => {
    const externalQueue = {
      add: queueAdd,
      close: vi.fn<() => Promise<void>>().mockResolvedValue(),
    } as unknown as Queue<PublishJobPayload>;

    const scheduler = createPublishScheduler({
      queue: externalQueue,
    });
    await scheduler.close();

    expect(queueClose).not.toHaveBeenCalled();
    expect(externalQueue.close).not.toHaveBeenCalled();
    /** Connection is still owned by the scheduler in this case → quit fires. */
    expect(connectionQuit).toHaveBeenCalledTimes(1);
  });

  it("close() does NOT quit an externally-supplied connection", async () => {
    const externalConn = {
      quit: vi.fn<() => Promise<"OK">>().mockResolvedValue("OK"),
    } as unknown as Redis;

    const scheduler = createPublishScheduler({
      connection: externalConn,
    });
    await scheduler.close();

    /** Caller owns the connection. */
    expect(externalConn.quit).not.toHaveBeenCalled();
    /** Internal queue was created → it should still be closed. */
    expect(queueClose).toHaveBeenCalledTimes(1);
  });

  it("swallows connection.quit() rejections so shutdown stays graceful", async () => {
    const flaky = {
      quit: vi
        .fn<() => Promise<never>>()
        .mockRejectedValue(new Error("connection already gone")),
    } as unknown as Redis;
    /** Force the owns-connection branch by NOT supplying connection. */
    vi.mocked(createRedisConnection).mockReturnValueOnce(flaky);

    const scheduler = createPublishScheduler();

    await expect(scheduler.close()).resolves.toBeUndefined();
    expect(flaky.quit).toHaveBeenCalled();
  });
});
