import { describe, expect, it, vi } from "vitest";
import {
  createStubPublishRunner,
  STUB_PUBLISH_RUNNER_DETAIL,
  withoutContext,
} from "./publish-runner.js";

const basePayload = {
  scheduleEntryId: "sched-1",
  tenantId: "tenant-1",
} as const;

describe("createStubPublishRunner", () => {
  it("returns a successful result with the default detail", async () => {
    const runner = createStubPublishRunner();
    const result = await runner(basePayload, {
      jobId: "job-1",
      attempt: 1,
    });
    expect(result).toEqual({
      ok: true,
      detail: STUB_PUBLISH_RUNNER_DETAIL,
    });
  });

  it("honors a custom detail and forwards context to onCall", async () => {
    const onCall = vi.fn();
    const runner = createStubPublishRunner({
      detail: "custom-detail",
      onCall,
    });

    const result = await runner(basePayload, {
      jobId: "job-2",
      attempt: 3,
    });

    expect(result.detail).toBe("custom-detail");
    expect(onCall).toHaveBeenCalledTimes(1);
    expect(onCall).toHaveBeenCalledWith(basePayload, {
      jobId: "job-2",
      attempt: 3,
    });
  });
});

describe("withoutContext", () => {
  it("invokes the wrapped runner with attempt=1 and no jobId", async () => {
    const inner = vi.fn().mockResolvedValue({ ok: true });
    const runner = withoutContext(inner);

    await runner(basePayload);

    expect(inner).toHaveBeenCalledWith(basePayload, {
      jobId: undefined,
      attempt: 1,
    });
  });
});
