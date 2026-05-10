import { afterEach, describe, expect, it } from "vitest";
import { defaultPublishJobOptions } from "./publish-queue.js";

describe("defaultPublishJobOptions", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it("uses defaults when env unset", () => {
    delete process.env.MARKETER_PUBLISH_JOB_ATTEMPTS;
    delete process.env.MARKETER_PUBLISH_BACKOFF_MS;
    const opts = defaultPublishJobOptions();
    expect(opts.attempts).toBe(5);
    expect(opts.backoff).toEqual({ type: "exponential", delay: 2000 });
  });

  it("respects MARKETER_PUBLISH_JOB_ATTEMPTS", () => {
    process.env.MARKETER_PUBLISH_JOB_ATTEMPTS = "8";
    expect(defaultPublishJobOptions().attempts).toBe(8);
  });
});
