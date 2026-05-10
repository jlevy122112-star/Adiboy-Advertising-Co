import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createHttpPublishRunner,
  createStubPublishRunner,
  resolvePublishRunnerFromEnv,
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

describe("createHttpPublishRunner", () => {
  it("POSTs payload + context and returns a valid JSON body", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, detail: "posted", externalId: "e1" }), {
        status: 200,
      }),
    );
    const runner = createHttpPublishRunner({
      url: "https://internal.example/publish",
      fetchFn,
    });

    const result = await runner(basePayload, { jobId: "job-x", attempt: 2 });

    expect(result).toEqual({
      ok: true,
      detail: "posted",
      externalId: "e1",
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [, init] = fetchFn.mock.calls[0] ?? [];
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      payload: basePayload,
      context: { jobId: "job-x", attempt: 2 },
    });
  });

  it("throws on 503 so BullMQ can retry", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("", { status: 503 }));
    const runner = createHttpPublishRunner({
      url: "https://internal.example/publish",
      fetchFn,
    });

    await expect(
      runner(basePayload, { jobId: "j", attempt: 1 }),
    ).rejects.toThrow(/publish_http_upstream_503/);
  });

  it("returns ok:false on 4xx without throwing", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response("bad input", { status: 400 }),
    );
    const runner = createHttpPublishRunner({
      url: "https://internal.example/publish",
      fetchFn,
    });

    const result = await runner(basePayload, { jobId: "j", attempt: 1 });

    expect(result.ok).toBe(false);
    expect(result.detail).toContain("publish_http_client_error:400");
  });
});

describe("resolvePublishRunnerFromEnv", () => {
  const prevUrl = process.env.MARKETER_PUBLISH_HTTP_URL;
  const prevToken = process.env.MARKETER_PUBLISH_HTTP_TOKEN;

  afterEach(() => {
    if (prevUrl === undefined) {
      delete process.env.MARKETER_PUBLISH_HTTP_URL;
    } else {
      process.env.MARKETER_PUBLISH_HTTP_URL = prevUrl;
    }
    if (prevToken === undefined) {
      delete process.env.MARKETER_PUBLISH_HTTP_TOKEN;
    } else {
      process.env.MARKETER_PUBLISH_HTTP_TOKEN = prevToken;
    }
  });

  it("uses stub when MARKETER_PUBLISH_HTTP_URL is unset", async () => {
    delete process.env.MARKETER_PUBLISH_HTTP_URL;
    const runner = resolvePublishRunnerFromEnv();
    const result = await runner(basePayload, { jobId: "a", attempt: 1 });
    expect(result.detail).toBe(STUB_PUBLISH_RUNNER_DETAIL);
  });

  it("uses HTTP runner when URL is set and attaches Bearer token when set", async () => {
    process.env.MARKETER_PUBLISH_HTTP_URL = "https://internal.example/run";
    process.env.MARKETER_PUBLISH_HTTP_TOKEN = "secret";

    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, detail: "via-env" }), {
        status: 200,
      }),
    );

    const runner = resolvePublishRunnerFromEnv({ fetchFn });
    const result = await runner(basePayload, { jobId: "b", attempt: 1 });

    expect(result).toEqual({ ok: true, detail: "via-env" });
    const [, init] = fetchFn.mock.calls[0] ?? [];
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer secret",
    });
  });
});
