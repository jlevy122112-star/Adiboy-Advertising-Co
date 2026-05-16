/**
 * Unit tests for Phase 5 social publish providers.
 * All network I/O (fetch + DB credential lookup) is mocked — no real tokens needed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock DB credential lookup before importing providers
vi.mock("../../db/social-credentials.js", () => ({
  lookupSocialCredential: vi.fn(),
}));

import { lookupSocialCredential } from "../../db/social-credentials.js";
import { xPublishProvider } from "./x.js";
import { metaPublishProvider } from "./meta.js";
import { linkedinPublishProvider } from "./linkedin.js";

const mockLookup = vi.mocked(lookupSocialCredential);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<{
  tenantId: string;
  scheduleEntryId: string;
  network: string;
  copyBody: string;
  adaptedBody: string;
}> = {}): Parameters<typeof xPublishProvider.publish>[0] {
  return {
    payload: {
      scheduleEntryId: overrides.scheduleEntryId ?? "entry_test_1",
      tenantId: overrides.tenantId ?? "tenant_test",
      network: overrides.network,
      copy: overrides.copyBody ? { body: overrides.copyBody } : undefined,
    },
    context: { attempt: 1, jobId: "job_test" },
    row: undefined,
    adaptedCopy: overrides.adaptedBody
      ? {
          network: "x" as const,
          copy: { body: overrides.adaptedBody },
          strategy: "truncate" as const,
          warnings: [],
          truncatedPaths: [],
        }
      : undefined,
  } as Parameters<typeof xPublishProvider.publish>[0];
}

function credOk(accessToken: string, extras: Record<string, unknown> = {}) {
  return {
    mode: "ok" as const,
    row: {
      tenant_id: "tenant_test",
      network: "x",
      access_token: accessToken,
      token_secret: null,
      expires_at: null,
      metadata: extras,
    },
  };
}

const credNotFound = { mode: "not_found" as const };
const credNoDb = { mode: "no_database" as const };

// ---------------------------------------------------------------------------
// X provider
// ---------------------------------------------------------------------------

describe("xPublishProvider", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("MARKETER_X_ACCESS_TOKEN", "");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns stub when no credential and no env var", async () => {
    mockLookup.mockResolvedValue(credNotFound);
    const result = await xPublishProvider.publish(makeInput({ copyBody: "Hello world" }));
    expect(result.ok).toBe(true);
    expect(result.detail).toContain("p4_stub_x");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back to env var when DB has no credential", async () => {
    mockLookup.mockResolvedValue(credNotFound);
    vi.stubEnv("MARKETER_X_ACCESS_TOKEN", "env_token_abc");
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "tweet_123", text: "Hello world" } }), {
        status: 200,
      }),
    );

    const result = await xPublishProvider.publish(makeInput({ copyBody: "Hello world" }));
    expect(result.ok).toBe(true);
    expect(result.externalId).toBe("tweet_123");
    expect(result.detail).toBe("x_published");
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toContain("api.twitter.com/2/tweets");
    expect((init as RequestInit).headers as Record<string, string>).toMatchObject({
      Authorization: "Bearer env_token_abc",
    });
  });

  it("uses DB credential when present", async () => {
    mockLookup.mockResolvedValue(credOk("db_token_xyz"));
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "tweet_456" } }), { status: 200 }),
    );

    const result = await xPublishProvider.publish(makeInput({ copyBody: "Test post" }));
    expect(result.ok).toBe(true);
    expect(result.externalId).toBe("tweet_456");
    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer db_token_xyz");
  });

  it("prefers adaptedCopy body over raw copy", async () => {
    mockLookup.mockResolvedValue(credOk("tok"));
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "t1" } }), { status: 200 }),
    );

    await xPublishProvider.publish(
      makeInput({ copyBody: "raw body", adaptedBody: "adapted body" }),
    );

    const [, init] = fetchSpy.mock.calls[0]!;
    const sent = JSON.parse((init as RequestInit).body as string) as { text: string };
    expect(sent.text).toBe("adapted body");
  });

  it("returns ok:false on API error response", async () => {
    mockLookup.mockResolvedValue(credOk("tok"));
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ errors: [{ message: "Unauthorized" }] }),
        { status: 401 },
      ),
    );

    const result = await xPublishProvider.publish(makeInput({ copyBody: "hi" }));
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("x_api_error");
  });

  it("returns ok:false on fetch network error", async () => {
    mockLookup.mockResolvedValue(credOk("tok"));
    fetchSpy.mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await xPublishProvider.publish(makeInput({ copyBody: "hi" }));
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("x_fetch_error");
  });

  it("truncates text to 280 chars", async () => {
    mockLookup.mockResolvedValue(credOk("tok"));
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "t1" } }), { status: 200 }),
    );
    const longText = "A".repeat(500);
    await xPublishProvider.publish(makeInput({ copyBody: longText }));
    const [, init] = fetchSpy.mock.calls[0]!;
    const sent = JSON.parse((init as RequestInit).body as string) as { text: string };
    expect(sent.text.length).toBe(280);
  });

  it("handles no_database mode gracefully (stub fallback)", async () => {
    mockLookup.mockResolvedValue(credNoDb);
    vi.stubEnv("MARKETER_X_ACCESS_TOKEN", "");
    const result = await xPublishProvider.publish(makeInput({ copyBody: "hi" }));
    expect(result.ok).toBe(true);
    expect(result.detail).toContain("p4_stub_x");
  });
});

// ---------------------------------------------------------------------------
// Meta provider
// ---------------------------------------------------------------------------

describe("metaPublishProvider", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("MARKETER_META_ACCESS_TOKEN", "");
    vi.stubEnv("MARKETER_META_PAGE_ID", "");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns stub when no credential", async () => {
    mockLookup.mockResolvedValue(credNotFound);
    const result = await metaPublishProvider.publish(makeInput({ copyBody: "hi" }));
    expect(result.ok).toBe(true);
    expect(result.detail).toContain("p4_stub_meta");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("publishes via Graph API when credentials present in DB", async () => {
    mockLookup.mockResolvedValue(
      credOk("page_token_abc", { pageId: "123456789" }),
    );
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ id: "123456789_987654321" }), { status: 200 }),
    );

    const result = await metaPublishProvider.publish(makeInput({ copyBody: "Check this out!" }));
    expect(result.ok).toBe(true);
    expect(result.externalId).toBe("123456789_987654321");
    expect(result.detail).toBe("meta_published");
    const [url] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toContain("123456789/feed");
  });

  it("uses env var credentials", async () => {
    mockLookup.mockResolvedValue(credNotFound);
    vi.stubEnv("MARKETER_META_ACCESS_TOKEN", "env_page_token");
    vi.stubEnv("MARKETER_META_PAGE_ID", "999888777");
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ id: "999888777_111222333" }), { status: 200 }),
    );

    const result = await metaPublishProvider.publish(makeInput({ copyBody: "Hello Meta" }));
    expect(result.ok).toBe(true);
    expect(result.externalId).toBe("999888777_111222333");
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toContain("999888777/feed");
    const sent = JSON.parse((init as RequestInit).body as string) as {
      message: string;
      access_token: string;
    };
    expect(sent.access_token).toBe("env_page_token");
    expect(sent.message).toBe("Hello Meta");
  });

  it("returns ok:false on Graph API error", async () => {
    mockLookup.mockResolvedValue(credOk("tok", { pageId: "123" }));
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Invalid OAuth access token", code: 190 } }),
        { status: 400 },
      ),
    );

    const result = await metaPublishProvider.publish(makeInput({ copyBody: "hi" }));
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("meta_api_error");
  });
});

// ---------------------------------------------------------------------------
// LinkedIn provider
// ---------------------------------------------------------------------------

describe("linkedinPublishProvider", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("MARKETER_LINKEDIN_ACCESS_TOKEN", "");
    vi.stubEnv("MARKETER_LINKEDIN_AUTHOR_URN", "");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns stub when no credential", async () => {
    mockLookup.mockResolvedValue(credNotFound);
    const result = await linkedinPublishProvider.publish(makeInput({ copyBody: "hi" }));
    expect(result.ok).toBe(true);
    expect(result.detail).toContain("p4_stub_linkedin");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("publishes via UGC API with DB credentials", async () => {
    mockLookup.mockResolvedValue(
      credOk("li_token_abc", { authorUrn: "urn:li:person:AbCdEf" }),
    );
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ id: "urn:li:ugcPost:123456789" }),
        {
          status: 201,
          headers: { "X-RestLi-Id": "urn:li:ugcPost:123456789" },
        },
      ),
    );

    const result = await linkedinPublishProvider.publish(
      makeInput({ copyBody: "Excited to share this!" }),
    );
    expect(result.ok).toBe(true);
    expect(result.externalId).toBe("urn:li:ugcPost:123456789");
    expect(result.detail).toBe("linkedin_published");

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toContain("api.linkedin.com/v2/ugcPosts");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer li_token_abc");
    expect(headers["X-Restli-Protocol-Version"]).toBe("2.0.0");
  });

  it("uses env var credentials", async () => {
    mockLookup.mockResolvedValue(credNotFound);
    vi.stubEnv("MARKETER_LINKEDIN_ACCESS_TOKEN", "env_li_token");
    vi.stubEnv("MARKETER_LINKEDIN_AUTHOR_URN", "urn:li:person:XyZ");
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ id: "urn:li:ugcPost:999" }), { status: 201 }),
    );

    const result = await linkedinPublishProvider.publish(makeInput({ copyBody: "Post!" }));
    expect(result.ok).toBe(true);

    const [, init] = fetchSpy.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string) as {
      author: string;
      lifecycleState: string;
    };
    expect(body.author).toBe("urn:li:person:XyZ");
    expect(body.lifecycleState).toBe("PUBLISHED");
  });

  it("includes correct UGC post structure", async () => {
    mockLookup.mockResolvedValue(
      credOk("tok", { authorUrn: "urn:li:person:Test" }),
    );
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ id: "urn:li:ugcPost:1" }), { status: 201 }),
    );

    await linkedinPublishProvider.publish(makeInput({ copyBody: "Hello LinkedIn" }));

    const [, init] = fetchSpy.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string) as {
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: string };
          shareMediaCategory: string;
        };
      };
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": string };
    };
    expect(
      body.specificContent["com.linkedin.ugc.ShareContent"].shareCommentary.text,
    ).toBe("Hello LinkedIn");
    expect(
      body.specificContent["com.linkedin.ugc.ShareContent"].shareMediaCategory,
    ).toBe("NONE");
    expect(
      body.visibility["com.linkedin.ugc.MemberNetworkVisibility"],
    ).toBe("PUBLIC");
  });

  it("returns ok:false on API error", async () => {
    mockLookup.mockResolvedValue(credOk("tok", { authorUrn: "urn:li:person:X" }));
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 }),
    );

    const result = await linkedinPublishProvider.publish(makeInput({ copyBody: "hi" }));
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("linkedin_api_error");
  });

  it("returns ok:false on fetch error", async () => {
    mockLookup.mockResolvedValue(credOk("tok", { authorUrn: "urn:li:person:X" }));
    fetchSpy.mockRejectedValue(new Error("Network down"));

    const result = await linkedinPublishProvider.publish(makeInput({ copyBody: "hi" }));
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("linkedin_fetch_error");
  });
});
