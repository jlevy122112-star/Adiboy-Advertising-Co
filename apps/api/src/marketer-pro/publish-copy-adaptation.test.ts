import { describe, expect, it } from "vitest";

import {
  computeAdaptedPublishCopy,
  publishRouteToPublishableNetwork,
} from "./publish-copy-adaptation.js";

describe("publishRouteToPublishableNetwork", () => {
  it("maps meta → facebook", () => {
    expect(publishRouteToPublishableNetwork("meta")).toBe("facebook");
  });

  it("returns null for generic", () => {
    expect(publishRouteToPublishableNetwork("generic")).toBeNull();
  });
});

describe("computeAdaptedPublishCopy", () => {
  it("returns undefined when payload has no copy", () => {
    expect(
      computeAdaptedPublishCopy(
        { scheduleEntryId: "a", tenantId: "b" },
        "x",
      ),
    ).toBeUndefined();
  });

  it("adapts copy for X when present", () => {
    const r = computeAdaptedPublishCopy(
      {
        scheduleEntryId: "a",
        tenantId: "b",
        copy: { body: "z".repeat(400) },
      },
      "x",
    );
    expect(r?.network).toBe("x");
    expect(r?.warnings.some((w) => w.code === "primary_text_truncated")).toBe(
      true,
    );
  });
});
