import { describe, expect, it } from "vitest";
import { badgeClasses } from "./index.js";

describe("badgeClasses", () => {
  it("includes layout and tone-specific classes", () => {
    const classes = badgeClasses("success");
    expect(classes).toContain("inline-flex");
    expect(classes).toContain("emerald");
  });
});
