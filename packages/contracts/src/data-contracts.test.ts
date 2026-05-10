import { describe, expect, it } from "vitest";
import type { TenantId } from "./tenant-context.js";
import { sameTenant } from "./data-contracts.js";

describe("sameTenant", () => {
  const t1 = "tenant-a" as TenantId;
  const t2 = "tenant-b" as TenantId;
  const base = {
    id: "1",
    tenantId: t1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  };

  it("returns true when tenant IDs match", () => {
    expect(
      sameTenant(base, {
        ...base,
        id: "other",
        tenantId: t1,
      }),
    ).toBe(true);
  });

  it("returns false when tenant IDs differ", () => {
    expect(
      sameTenant(base, {
        ...base,
        tenantId: t2,
      }),
    ).toBe(false);
  });
});
