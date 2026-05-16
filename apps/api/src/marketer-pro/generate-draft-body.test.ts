import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GenerationBriefSchema } from "@home-link/marketer-pro-contract";

import {
  buildStubDraftBodyFromBrief,
  generateDraftBodyFromBrief,
} from "./generate-draft-body.js";

const T0 = "2026-05-10T12:00:00.000Z";

function minimalBrief() {
  return GenerationBriefSchema.parse({
    briefId: "brief_gen_test",
    workspaceId: "tenant_ws",
    runId: null,
    scheduleEntryId: null,
    parentBriefId: null,
    formatId: "ig-feed-square",
    network: "instagram",
    copy: { headline: "Summer drop is live" },
    design: {
      paletteMode: "brand_primary",
      imageryDirection: "none",
      layoutIntent: "centered",
    },
    source: "manual_user",
    fieldSources: {},
    status: "draft",
    failureKind: null,
    failureMessage: null,
    resultId: null,
    createdAt: T0,
    updatedAt: T0,
    finalisedAt: null,
  });
}

describe("generate-draft-body", () => {
  const origKey = process.env.MARKETER_OPENAI_API_KEY;
  const origOpen = process.env.OPENAI_API_KEY;
  const origBase = process.env.MARKETER_OPENAI_BASE_URL;
  const origModel = process.env.MARKETER_GENERATION_MODEL;

  beforeEach(() => {
    delete process.env.MARKETER_OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.MARKETER_OPENAI_BASE_URL;
    delete process.env.MARKETER_GENERATION_MODEL;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (origKey !== undefined) {
      process.env.MARKETER_OPENAI_API_KEY = origKey;
    } else {
      delete process.env.MARKETER_OPENAI_API_KEY;
    }
    if (origOpen !== undefined) {
      process.env.OPENAI_API_KEY = origOpen;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
    if (origBase !== undefined) {
      process.env.MARKETER_OPENAI_BASE_URL = origBase;
    } else {
      delete process.env.MARKETER_OPENAI_BASE_URL;
    }
    if (origModel !== undefined) {
      process.env.MARKETER_GENERATION_MODEL = origModel;
    } else {
      delete process.env.MARKETER_GENERATION_MODEL;
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("buildStubDraftBodyFromBrief matches sync stub shape", () => {
    const brief = minimalBrief();
    const body = buildStubDraftBodyFromBrief(brief);
    expect(body).toContain("instagram");
    expect(body).toContain("Summer drop is live");
    expect(body).toContain("Stub draft");
  });

  it("generateDraftBodyFromBrief uses stub when no API key", async () => {
    const brief = minimalBrief();
    const body = await generateDraftBodyFromBrief(brief);
    expect(body).toContain("Stub draft");
    expect(body).toContain("brief_gen_test");
  });

  it("generateDraftBodyFromBrief uses OpenAI when key is set", async () => {
    process.env.MARKETER_OPENAI_API_KEY = "sk-test";
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          choices: [{ message: { content: "  AI line one\n" } }],
        }),
    });
    vi.stubGlobal("fetch", mockFetch);
    const brief = minimalBrief();
    const body = await generateDraftBodyFromBrief(brief);
    expect(body).toBe("AI line one");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0]![0] as string;
    expect(url).toContain("/chat/completions");
  });

  it("falls back to stub on OpenAI HTTP error", async () => {
    process.env.MARKETER_OPENAI_API_KEY = "sk-test";
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"error":"bad"}',
    });
    vi.stubGlobal("fetch", mockFetch);
    const brief = minimalBrief();
    const body = await generateDraftBodyFromBrief(brief);
    expect(body).toContain("Stub draft");
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
