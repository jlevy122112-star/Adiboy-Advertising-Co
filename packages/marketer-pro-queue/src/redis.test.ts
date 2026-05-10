import { beforeEach, describe, expect, it, vi } from "vitest";

const RedisSpy = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    on: vi.fn(),
  })),
);

vi.mock("ioredis", () => ({
  Redis: RedisSpy,
}));

import { createRedisConnection } from "./redis.js";

describe("createRedisConnection", () => {
  beforeEach(() => {
    RedisSpy.mockClear();
  });

  it("merges overrides then forces BullMQ connection invariants", () => {
    const retryStrategy = (times: number) => (times > 4 ? null : 50);

    createRedisConnection("redis://127.0.0.1:6379", {
      enableOfflineQueue: false,
      retryStrategy,
    });

    expect(RedisSpy).toHaveBeenCalledTimes(1);
    const [, opts] = RedisSpy.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];

    expect(opts.enableOfflineQueue).toBe(false);
    expect(opts.retryStrategy).toBe(retryStrategy);
    expect(opts.maxRetriesPerRequest).toBeNull();
    expect(opts.enableReadyCheck).toBe(true);
    expect(opts.lazyConnect).toBe(false);
  });

  it("does not allow invariant keys to leak through overrides at runtime", () => {
    createRedisConnection("redis://127.0.0.1:6379", {
      enableReadyCheck: false,
      lazyConnect: true,
      maxRetriesPerRequest: 10,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime regression for mistaken spreads/casts
    } as any);

    const [, opts] = RedisSpy.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];

    expect(opts.maxRetriesPerRequest).toBeNull();
    expect(opts.enableReadyCheck).toBe(true);
    expect(opts.lazyConnect).toBe(false);
  });
});
