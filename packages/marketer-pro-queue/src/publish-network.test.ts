import { describe, expect, it } from "vitest";
import {
  classifyPublishNetwork,
  isPublishNetworkSlug,
  PUBLISH_NETWORK_SLUGS,
} from "./publish-network.js";

describe("classifyPublishNetwork", () => {
  it("returns generic when missing or blank", () => {
    expect(classifyPublishNetwork(undefined)).toBe("generic");
    expect(classifyPublishNetwork("")).toBe("generic");
    expect(classifyPublishNetwork("   ")).toBe("generic");
  });

  it("normalizes case and maps synonyms", () => {
    expect(classifyPublishNetwork("META")).toBe("meta");
    expect(classifyPublishNetwork("Facebook")).toBe("meta");
    expect(classifyPublishNetwork("twitter")).toBe("x");
  });

  it("passes through known slugs", () => {
    for (const slug of PUBLISH_NETWORK_SLUGS) {
      expect(classifyPublishNetwork(slug)).toBe(slug);
    }
  });

  it("maps arbitrary strings to generic", () => {
    expect(classifyPublishNetwork("smoke")).toBe("generic");
    expect(classifyPublishNetwork("test")).toBe("generic");
  });
});

describe("isPublishNetworkSlug", () => {
  it("narrows known slugs only", () => {
    expect(isPublishNetworkSlug("meta")).toBe(true);
    expect(isPublishNetworkSlug("smoke")).toBe(false);
  });
});
