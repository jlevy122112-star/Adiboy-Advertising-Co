import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closePostgres } from "../db/postgres.js";
import {
  executeInternalPublish,
  executeInternalPublishHttp,
  runPublishForScheduleEntry,
} from "./publish-execute.js";

const previousDatabaseUrl = process.env.DATABASE_URL;

function validWorkerBody(overrides?: {
  payload?: Record<string, unknown>;
  context?: Record<string, unknown>;
}) {
  return {
    payload: {
      scheduleEntryId: "sched-1",
      tenantId: "tenant-1",
      network: "facebook",
      correlationId: "worker-http-test",
      ...overrides?.payload,
    },
    context: {
      jobId: "job-1",
      attempt: 2,
      ...overrides?.context,
    },
  };
}

describe("worker internal publish execution contract", () => {
  beforeEach(async () => {
    delete process.env.DATABASE_URL;
    await closePostgres();
  });

  afterEach(async () => {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
    await closePostgres();
  });

  describe("executeInternalPublish", () => {
    it("preserves provider externalId through dispatch for Meta (facebook synonym)", async () => {
      const outcome = await executeInternalPublish(validWorkerBody());

      expect(outcome).toEqual({
        ok: true,
        result: {
          ok: true,
          detail: "p4_stub_meta_wire_sdk",
          externalId: "meta:sched-1",
        },
      });
    });

    it("preserves provider externalId for canonical x slug", async () => {
      const outcome = await executeInternalPublish(
        validWorkerBody({
          payload: { scheduleEntryId: "entry-x", network: "x" },
        }),
      );

      expect(outcome).toEqual({
        ok: true,
        result: {
          ok: true,
          detail: "p4_stub_x_wire_sdk",
          externalId: "x:entry-x",
        },
      });
    });

    it("preserves externalId when copy is present (adaptation runs before stub)", async () => {
      const outcome = await executeInternalPublish(
        validWorkerBody({
          payload: {
            scheduleEntryId: "sched-copy",
            network: "x",
            copy: { body: "z".repeat(400) },
          },
        }),
      );

      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.result.externalId).toBe("x:sched-copy");
        expect(outcome.result.ok).toBe(true);
        expect(outcome.result.detail).toMatch(/p4_stub_x_wire_sdk/);
        expect(outcome.result.detail).toContain("_adapted:w=");
      }
    });

    it("returns structured 400 with Zod issues for missing tenantId", async () => {
      const outcome = await executeInternalPublish({
        payload: {
          scheduleEntryId: "sched-1",
        },
        context: { attempt: 1 },
      });

      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.status).toBe(400);
        expect(outcome.message).toMatch(/tenantId/i);
        expect(outcome.issues.length).toBeGreaterThan(0);
        expect(
          outcome.issues.some((i) => i.path.includes("tenantId")),
        ).toBe(true);
      }
    });

    it("returns structured 400 for non-positive attempt", async () => {
      const outcome = await executeInternalPublish({
        payload: {
          scheduleEntryId: "sched-1",
          tenantId: "t1",
        },
        context: {
          attempt: 0,
        },
      });

      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.status).toBe(400);
        expect(outcome.issues.some((i) => /attempt/i.test(i.path))).toBe(
          true,
        );
      }
    });

    it("returns structured 400 for invalid copy (strict object)", async () => {
      const outcome = await executeInternalPublish({
        payload: {
          scheduleEntryId: "s1",
          tenantId: "t1",
          copy: { body: "ok", unknownKey: true },
        },
        context: { attempt: 1 },
      });

      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.status).toBe(400);
        expect(
          outcome.issues.some((i) => i.path.includes("copy")),
        ).toBe(true);
      }
    });

    it("returns structured 400 for invalid copy link (non-https)", async () => {
      const outcome = await executeInternalPublish({
        payload: {
          scheduleEntryId: "s1",
          tenantId: "t1",
          copy: { link: "http://example.com" },
        },
        context: { attempt: 1 },
      });

      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.status).toBe(400);
        expect(
          outcome.issues.some((i) => i.path.includes("link")),
        ).toBe(true);
      }
    });

    it("returns structured 400 when body is not an object shape", async () => {
      const outcome = await executeInternalPublish(["not", "an", "object"]);

      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.status).toBe(400);
        expect(outcome.issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe("executeInternalPublishHttp (worker HTTP JSON contract)", () => {
    beforeEach(async () => {
      delete process.env.DATABASE_URL;
      await closePostgres();
    });

    afterEach(async () => {
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }
      await closePostgres();
    });

    it("maps success to status 200 and flat PublishJobResult body", async () => {
      const res = await executeInternalPublishHttp(validWorkerBody());

      expect(res).toEqual({
        status: 200,
        body: {
          ok: true,
          detail: "p4_stub_meta_wire_sdk",
          externalId: "meta:sched-1",
        },
      });
    });

    it("maps validation failure to status 400 and structured error body", async () => {
      const res = await executeInternalPublishHttp({
        payload: { scheduleEntryId: "x" },
        context: { attempt: 1 },
      });

      expect(res.status).toBe(400);
      if (res.status === 400) {
        expect(res.body.error).toBe("validation_error");
        expect(typeof res.body.message).toBe("string");
        expect(res.body.message.length).toBeGreaterThan(0);
        expect(Array.isArray(res.body.issues)).toBe(true);
        expect(res.body.issues.length).toBeGreaterThan(0);
        expect(res.body).toMatchObject({
          error: "validation_error",
        });
      }
    });
  });
});

describe("runPublishForScheduleEntry", () => {
  beforeEach(async () => {
    delete process.env.DATABASE_URL;
    await closePostgres();
  });

  afterEach(async () => {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
    await closePostgres();
  });

  it("uses the no-database dispatch path for local worker smoke verification", async () => {
    const result = await runPublishForScheduleEntry(
      {
        scheduleEntryId: "sched-2",
        tenantId: "tenant-1",
        network: "smoke",
      },
      {
        jobId: "job-2",
        attempt: 1,
      },
    );

    expect(result).toEqual({
      ok: true,
      detail: "p4_stub_generic_wire_sdk",
      externalId: "generic:sched-2",
    });
  });
});
