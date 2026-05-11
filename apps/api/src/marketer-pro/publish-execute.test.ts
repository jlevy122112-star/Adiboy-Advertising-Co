import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closePostgres } from "../db/postgres.js";
import {
  executeInternalPublish,
  runPublishForScheduleEntry,
} from "./publish-execute.js";

const previousDatabaseUrl = process.env.DATABASE_URL;

describe("executeInternalPublish", () => {
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

  it("executes a valid worker payload and preserves provider externalId", async () => {
    const outcome = await executeInternalPublish({
      payload: {
        scheduleEntryId: "sched-1",
        tenantId: "tenant-1",
        network: "facebook",
        correlationId: "worker-http-test",
      },
      context: {
        jobId: "job-1",
        attempt: 2,
      },
    });

    expect(outcome).toEqual({
      ok: true,
      result: {
        ok: true,
        detail: "p4_stub_meta_wire_sdk",
        externalId: "meta:sched-1",
      },
    });
  });

  it("returns a 400 validation result for malformed worker bodies", async () => {
    const outcome = await executeInternalPublish({
      payload: {
        scheduleEntryId: "sched-1",
      },
      context: {
        attempt: 0,
      },
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.status).toBe(400);
      expect(outcome.message).toMatch(/tenantId|attempt/i);
    }
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

  it("uses the no-database dispatch path for local worker verification", async () => {
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
