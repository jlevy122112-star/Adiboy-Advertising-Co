import { describe, expect, test } from "vitest";

import {
  BRIEF_FAILURE_KINDS,
  BRIEF_SOURCES,
  BRIEF_STATUSES,
  BriefFailureKindSchema,
  BriefFieldSourcesSchema,
  BriefSourceSchema,
  BriefStatusSchema,
  briefIdFor,
  CopyDirectivesSchema,
  createBrief,
  DesignDirectivesSchema,
  GenerationBriefSchema,
  IMAGERY_DIRECTIONS,
  ImageryDirectionSchema,
  isFinalised,
  isPendingGenerator,
  isReadyForGenerator,
  isTerminalBriefStatus,
  LAYOUT_INTENTS,
  LayoutIntentSchema,
  listAllBriefStatuses,
  PALETTE_MODES,
  PaletteModeSchema,
  recordFieldSource,
  transitionBriefStatus,
  validateBriefForGeneration,
  validateBriefTransition,
  VOICE_TONE_SHIFTS,
  VoiceDirectivesSchema,
  VoiceToneShiftSchema,
  type BriefStatus,
  type CopyDirectives,
  type DesignDirectives,
  type GenerationBrief,
} from "./generation-brief.js";

const T0 = "2026-05-10T12:00:00.000Z";
const T1 = "2026-05-10T12:01:00.000Z";
const T2 = "2026-05-10T12:02:00.000Z";

const minimalCopy: CopyDirectives = {
  headline: "Save 20% on every order",
};

const minimalDesign: DesignDirectives = {
  paletteMode: "brand_primary",
  imageryDirection: "none",
  layoutIntent: "centered",
};

function buildValidBrief(
  overrides: Partial<GenerationBrief> = {},
): GenerationBrief {
  const base: GenerationBrief = {
    briefId: "brief_test_001",
    workspaceId: "ws_001",
    runId: null,
    scheduleEntryId: null,
    parentBriefId: null,
    formatId: "ig-feed-square",
    network: "instagram",
    copy: minimalCopy,
    design: minimalDesign,
    voice: undefined,
    seo: undefined,
    imageOpt: undefined,
    themeOverride: undefined,
    source: "manual_user",
    fieldSources: {},
    status: "draft",
    failureKind: null,
    failureMessage: null,
    resultId: null,
    createdAt: T0,
    updatedAt: T0,
    finalisedAt: null,
    ...overrides,
  };
  return base;
}

/* -------------------------------------------------------------------------- */
/*                              Constant rosters                              */
/* -------------------------------------------------------------------------- */

describe("BRIEF_STATUSES + BRIEF_SOURCES + BRIEF_FAILURE_KINDS", () => {
  test("BRIEF_STATUSES is the canonical six-status list", () => {
    expect(BRIEF_STATUSES).toEqual([
      "draft",
      "validated",
      "generating",
      "generated",
      "failed",
      "obsolete",
    ]);
  });

  test("BRIEF_SOURCES is the canonical four-source list", () => {
    expect(BRIEF_SOURCES).toEqual([
      "manual_user",
      "ai_proposed",
      "ai_committed",
      "autonomous_run",
    ]);
  });

  test("BRIEF_FAILURE_KINDS covers the seven canonical kinds", () => {
    expect(BRIEF_FAILURE_KINDS).toHaveLength(7);
    expect(BRIEF_FAILURE_KINDS).toContain("policy_blocked");
    expect(BRIEF_FAILURE_KINDS).toContain("brand_theme_lint_blocked");
    expect(BRIEF_FAILURE_KINDS).toContain("internal_error");
  });

  test("schemas accept exactly their canonical sets", () => {
    for (const s of BRIEF_STATUSES) expect(BriefStatusSchema.parse(s)).toBe(s);
    for (const s of BRIEF_SOURCES) expect(BriefSourceSchema.parse(s)).toBe(s);
    for (const s of BRIEF_FAILURE_KINDS)
      expect(BriefFailureKindSchema.parse(s)).toBe(s);
    expect(() => BriefStatusSchema.parse("not_a_status")).toThrow();
    expect(() => BriefSourceSchema.parse("ai_only")).toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/*                              CopyDirectivesSchema                          */
/* -------------------------------------------------------------------------- */

describe("CopyDirectivesSchema", () => {
  test("accepts all-empty (every field is optional)", () => {
    expect(CopyDirectivesSchema.parse({})).toEqual({});
  });

  test("rejects unknown fields (strict)", () => {
    expect(() =>
      CopyDirectivesSchema.parse({ headline: "x", unknown: 1 }),
    ).toThrow();
  });

  test("rejects more than 40 hashtags", () => {
    const tags = Array.from({ length: 41 }, (_, i) => `tag${i}`);
    expect(() => CopyDirectivesSchema.parse({ hashtags: tags })).toThrow();
  });

  test("rejects non-https links", () => {
    expect(() =>
      CopyDirectivesSchema.parse({ link: "http://insecure.example.com" }),
    ).toThrow();
    expect(
      CopyDirectivesSchema.parse({ link: "https://secure.example.com" }).link,
    ).toBe("https://secure.example.com");
  });

  test("permits an empty link string", () => {
    expect(CopyDirectivesSchema.parse({ link: "" }).link).toBe("");
  });
});

/* -------------------------------------------------------------------------- */
/*                              DesignDirectivesSchema                        */
/* -------------------------------------------------------------------------- */

describe("DesignDirectivesSchema", () => {
  test("accepts a minimal triple", () => {
    expect(DesignDirectivesSchema.parse(minimalDesign)).toEqual(minimalDesign);
  });

  test("requires customPaletteHex when paletteMode is 'custom_hex'", () => {
    expect(() =>
      DesignDirectivesSchema.parse({
        ...minimalDesign,
        paletteMode: "custom_hex",
      }),
    ).toThrow();
    expect(
      DesignDirectivesSchema.parse({
        ...minimalDesign,
        paletteMode: "custom_hex",
        customPaletteHex: ["#ff0080"],
      }).customPaletteHex,
    ).toEqual(["#ff0080"]);
  });

  test("rejects malformed hex in customPaletteHex", () => {
    expect(() =>
      DesignDirectivesSchema.parse({
        ...minimalDesign,
        paletteMode: "custom_hex",
        customPaletteHex: ["not-a-hex"],
      }),
    ).toThrow();
  });

  test("requires imageryQuery for stock_photo / ai_generated", () => {
    expect(() =>
      DesignDirectivesSchema.parse({
        ...minimalDesign,
        imageryDirection: "stock_photo",
      }),
    ).toThrow();
    expect(() =>
      DesignDirectivesSchema.parse({
        ...minimalDesign,
        imageryDirection: "ai_generated",
      }),
    ).toThrow();
    expect(
      DesignDirectivesSchema.parse({
        ...minimalDesign,
        imageryDirection: "stock_photo",
        imageryQuery: "warm sunset over coffee shop",
      }).imageryQuery,
    ).toBe("warm sunset over coffee shop");
  });

  test("requires imageryAssetId when imageryDirection is 'user_uploaded'", () => {
    expect(() =>
      DesignDirectivesSchema.parse({
        ...minimalDesign,
        imageryDirection: "user_uploaded",
      }),
    ).toThrow();
    expect(
      DesignDirectivesSchema.parse({
        ...minimalDesign,
        imageryDirection: "user_uploaded",
        imageryAssetId: "asset_42",
      }).imageryAssetId,
    ).toBe("asset_42");
  });

  test("rosters export the canonical sets", () => {
    expect(PALETTE_MODES).toContain("brand_primary");
    expect(PALETTE_MODES).toContain("custom_hex");
    expect(IMAGERY_DIRECTIONS).toContain("user_uploaded");
    expect(IMAGERY_DIRECTIONS).toContain("none");
    expect(LAYOUT_INTENTS).toContain("centered");
    expect(LAYOUT_INTENTS).toContain("free_form");
    expect(VOICE_TONE_SHIFTS).toContain("match_brand");
    expect(() => PaletteModeSchema.parse("nope")).toThrow();
    expect(() => ImageryDirectionSchema.parse("nope")).toThrow();
    expect(() => LayoutIntentSchema.parse("nope")).toThrow();
    expect(() => VoiceToneShiftSchema.parse("nope")).toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/*                              VoiceDirectivesSchema                         */
/* -------------------------------------------------------------------------- */

describe("VoiceDirectivesSchema", () => {
  test("accepts a tone shift only", () => {
    expect(VoiceDirectivesSchema.parse({ toneShift: "more_urgent" })).toEqual({
      toneShift: "more_urgent",
    });
  });

  test("formalityOverride accepts integers 1–5", () => {
    for (const f of [1, 2, 3, 4, 5]) {
      expect(
        VoiceDirectivesSchema.parse({
          toneShift: "match_brand",
          formalityOverride: f,
        }).formalityOverride,
      ).toBe(f);
    }
    expect(() =>
      VoiceDirectivesSchema.parse({
        toneShift: "match_brand",
        formalityOverride: 0,
      }),
    ).toThrow();
    expect(() =>
      VoiceDirectivesSchema.parse({
        toneShift: "match_brand",
        formalityOverride: 6,
      }),
    ).toThrow();
  });

  test("caps banned/preferred phrase arrays", () => {
    expect(() =>
      VoiceDirectivesSchema.parse({
        toneShift: "match_brand",
        bannedWordsAdditional: Array.from({ length: 41 }, (_, i) => `w${i}`),
      }),
    ).toThrow();
    expect(() =>
      VoiceDirectivesSchema.parse({
        toneShift: "match_brand",
        preferredPhrasesAdditional: Array.from(
          { length: 21 },
          (_, i) => `p${i}`,
        ),
      }),
    ).toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/*                              BriefFieldSourcesSchema                       */
/* -------------------------------------------------------------------------- */

describe("BriefFieldSourcesSchema", () => {
  test("accepts a sparse map", () => {
    expect(
      BriefFieldSourcesSchema.parse({
        "copy.headline": "ai",
        "design.paletteMode": "user",
      }),
    ).toEqual({ "copy.headline": "ai", "design.paletteMode": "user" });
  });

  test("rejects more than 200 entries", () => {
    const big: Record<string, "ai"> = {};
    for (let i = 0; i < 201; i++) big[`field.${i}`] = "ai";
    expect(() => BriefFieldSourcesSchema.parse(big)).toThrow();
  });

  test("rejects unknown decision sources", () => {
    expect(() =>
      BriefFieldSourcesSchema.parse({ "copy.headline": "alien" }),
    ).toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/*                              GenerationBriefSchema                         */
/* -------------------------------------------------------------------------- */

describe("GenerationBriefSchema (refinements)", () => {
  test("accepts a minimal valid draft brief", () => {
    const brief = buildValidBrief();
    expect(GenerationBriefSchema.parse(brief)).toEqual(brief);
  });

  test("rejects unknown top-level fields (strict)", () => {
    const brief = { ...buildValidBrief(), bogus: 1 } as GenerationBrief & {
      bogus: number;
    };
    expect(() => GenerationBriefSchema.parse(brief)).toThrow();
  });

  test("requires failureKind when status is 'failed'", () => {
    const ok = buildValidBrief({
      status: "failed",
      failureKind: "internal_error",
      failureMessage: "boom",
      finalisedAt: T1,
    });
    expect(GenerationBriefSchema.parse(ok)).toEqual(ok);

    const bad = buildValidBrief({
      status: "failed",
      failureKind: null,
      failureMessage: "boom",
      finalisedAt: T1,
    });
    expect(() => GenerationBriefSchema.parse(bad)).toThrow();
  });

  test("requires resultId when status is 'generated'", () => {
    const ok = buildValidBrief({
      status: "generated",
      resultId: "result_x",
      finalisedAt: T1,
    });
    expect(GenerationBriefSchema.parse(ok)).toEqual(ok);

    const bad = buildValidBrief({
      status: "generated",
      resultId: null,
      finalisedAt: T1,
    });
    expect(() => GenerationBriefSchema.parse(bad)).toThrow();
  });

  test("requires finalisedAt for terminal statuses and forbids it for non-terminal", () => {
    const terminalNoFinal = buildValidBrief({
      status: "obsolete",
      finalisedAt: null,
    });
    expect(() => GenerationBriefSchema.parse(terminalNoFinal)).toThrow();

    const nonTerminalWithFinal = buildValidBrief({
      status: "draft",
      finalisedAt: T1,
    });
    expect(() => GenerationBriefSchema.parse(nonTerminalWithFinal)).toThrow();
  });

  test("requires runId when source is 'autonomous_run'", () => {
    const bad = buildValidBrief({
      source: "autonomous_run",
      runId: null,
      scheduleEntryId: "se_001",
    });
    expect(() => GenerationBriefSchema.parse(bad)).toThrow();
    const ok = { ...bad, runId: "run_001" };
    expect(GenerationBriefSchema.parse(ok)).toEqual(ok);
  });
});

/* -------------------------------------------------------------------------- */
/*                              validateBriefTransition                       */
/* -------------------------------------------------------------------------- */

describe("validateBriefTransition", () => {
  test("legal: draft → validated, validated → generating, generating → generated", () => {
    expect(validateBriefTransition("draft", "validated")).toEqual({ ok: true });
    expect(validateBriefTransition("validated", "generating")).toEqual({
      ok: true,
    });
    expect(validateBriefTransition("generating", "generated")).toEqual({
      ok: true,
    });
  });

  test("illegal: draft → generating skips the validated gate", () => {
    expect(validateBriefTransition("draft", "generating")).toEqual({
      ok: false,
      reason: "to_status_not_legal_from_origin",
    });
  });

  test("rejects same-status transitions", () => {
    expect(validateBriefTransition("draft", "draft")).toEqual({
      ok: false,
      reason: "same_status",
    });
  });

  test("rejects transitions out of obsolete (terminal)", () => {
    for (const to of BRIEF_STATUSES.filter((s) => s !== "obsolete")) {
      expect(validateBriefTransition("obsolete", to as BriefStatus)).toEqual({
        ok: false,
        reason: "from_status_terminal",
      });
    }
  });

  test("every non-terminal status reaches obsolete in one step", () => {
    for (const from of BRIEF_STATUSES.filter((s) => s !== "obsolete")) {
      expect(validateBriefTransition(from as BriefStatus, "obsolete")).toEqual({
        ok: true,
      });
    }
  });

  test("isTerminalBriefStatus identifies obsolete only", () => {
    expect(isTerminalBriefStatus("obsolete")).toBe(true);
    expect(isTerminalBriefStatus("generated")).toBe(false);
    expect(isTerminalBriefStatus("failed")).toBe(false);
    expect(isTerminalBriefStatus("draft")).toBe(false);
  });

  test("validated can revert to draft (user re-edit)", () => {
    expect(validateBriefTransition("validated", "draft")).toEqual({ ok: true });
  });
});

/* -------------------------------------------------------------------------- */
/*                              createBrief factory                           */
/* -------------------------------------------------------------------------- */

describe("createBrief", () => {
  test("returns a draft brief that round-trips through the schema", () => {
    const b = createBrief({
      briefId: "brief_x",
      workspaceId: "ws_001",
      formatId: "ig-feed-square",
      network: "instagram",
      source: "manual_user",
      copy: minimalCopy,
      now: () => T0,
    });
    expect(GenerationBriefSchema.parse(b)).toEqual(b);
    expect(b.status).toBe("draft");
    expect(b.fieldSources).toEqual({});
    expect(b.failureKind).toBeNull();
    expect(b.resultId).toBeNull();
    expect(b.finalisedAt).toBeNull();
  });

  test("uses now() for createdAt + updatedAt", () => {
    const b = createBrief({
      briefId: "brief_x",
      workspaceId: "ws_001",
      formatId: "ig-feed-square",
      network: "instagram",
      source: "manual_user",
      copy: minimalCopy,
      now: () => T1,
    });
    expect(b.createdAt).toBe(T1);
    expect(b.updatedAt).toBe(T1);
  });

  test("autonomous_run requires a runId at construction", () => {
    expect(() =>
      createBrief({
        briefId: "brief_x",
        workspaceId: "ws_001",
        formatId: "ig-feed-square",
        network: "instagram",
        source: "autonomous_run",
        copy: minimalCopy,
        runId: null,
      }),
    ).toThrow();
  });

  test("preserves caller-provided fieldSources", () => {
    const b = createBrief({
      briefId: "brief_x",
      workspaceId: "ws_001",
      formatId: "ig-feed-square",
      network: "instagram",
      source: "manual_user",
      copy: minimalCopy,
      fieldSources: { "copy.headline": "user" },
    });
    expect(b.fieldSources).toEqual({ "copy.headline": "user" });
  });
});

/* -------------------------------------------------------------------------- */
/*                              validateBriefForGeneration                    */
/* -------------------------------------------------------------------------- */

describe("validateBriefForGeneration", () => {
  test("ok for a complete brief", () => {
    const r = validateBriefForGeneration(buildValidBrief());
    expect(r).toEqual({ ok: true });
  });

  test("flags missing copy.headline", () => {
    const b = buildValidBrief({ copy: { ...minimalCopy, headline: "" } });
    const r = validateBriefForGeneration(b);
    if (r.ok) throw new Error("expected validation failure");
    expect(r.issues.map((i) => i.code)).toContain("missing_copy_headline");
  });

  test("flags missing design directives entirely", () => {
    const b = buildValidBrief({ design: undefined });
    const r = validateBriefForGeneration(b);
    if (r.ok) throw new Error("expected validation failure");
    expect(r.issues.map((i) => i.code)).toContain("missing_design");
  });

  test("flags an unknown formatId", () => {
    const b = buildValidBrief({ formatId: "made-up-format" });
    const r = validateBriefForGeneration(b);
    if (r.ok) throw new Error("expected validation failure");
    expect(r.issues.map((i) => i.code)).toContain("format_unknown");
  });

  test("flags a publishable-network mismatch", () => {
    // ig-feed-square targets instagram; declaring x is a mismatch.
    const b = buildValidBrief({
      formatId: "ig-feed-square",
      network: "x",
    });
    const r = validateBriefForGeneration(b);
    if (r.ok) throw new Error("expected validation failure");
    expect(r.issues.map((i) => i.code)).toContain("format_network_mismatch");
  });

  test("does NOT flag a mismatch for non-publishable formats (e.g. web)", () => {
    // web-blog-hero is "web" — not in PUBLISHABLE_NETWORKS, so the brief
    // network is not constrained against the format.
    const b = buildValidBrief({
      formatId: "web-blog-hero",
      network: "facebook",
    });
    const r = validateBriefForGeneration(b);
    expect(r.ok).toBe(true);
  });

  test("flags a long-form body when over the threshold", () => {
    const b = buildValidBrief({
      copy: {
        ...minimalCopy,
        maxBodyChars: 1000,
        body: "",
      },
    });
    const r = validateBriefForGeneration(b);
    if (r.ok) throw new Error("expected validation failure");
    expect(r.issues.map((i) => i.code)).toContain(
      "missing_copy_body_for_long_form",
    );
  });

  test("respects a custom long-form threshold", () => {
    const b = buildValidBrief({
      copy: { ...minimalCopy, maxBodyChars: 100 },
    });
    expect(validateBriefForGeneration(b, { longFormBodyThreshold: 200 })).toEqual({
      ok: true,
    });
    expect(
      validateBriefForGeneration(b, { longFormBodyThreshold: 50 }).ok,
    ).toBe(false);
  });

  test("flags missing imageryQuery for stock_photo", () => {
    const b = buildValidBrief({
      design: {
        ...minimalDesign,
        imageryDirection: "stock_photo",
        imageryQuery: " ",
      },
    });
    const r = validateBriefForGeneration(b);
    if (r.ok) throw new Error("expected validation failure");
    expect(r.issues.map((i) => i.code)).toContain("missing_imagery_query");
  });

  test("flags missing custom palette when paletteMode is custom_hex", () => {
    const b = buildValidBrief({
      design: {
        ...minimalDesign,
        paletteMode: "custom_hex",
        customPaletteHex: [],
      },
    });
    const r = validateBriefForGeneration(b);
    if (r.ok) throw new Error("expected validation failure");
    expect(r.issues.map((i) => i.code)).toContain("missing_custom_palette");
  });
});

/* -------------------------------------------------------------------------- */
/*                              transitionBriefStatus                         */
/* -------------------------------------------------------------------------- */

describe("transitionBriefStatus", () => {
  test("draft → validated returns a new brief without mutating", () => {
    const before = buildValidBrief();
    const r = transitionBriefStatus(before, {
      to: "validated",
      now: () => T1,
    });
    if (!r.ok) throw new Error("expected ok");
    expect(r.brief.status).toBe("validated");
    expect(r.brief.updatedAt).toBe(T1);
    expect(r.brief.finalisedAt).toBeNull();
    expect(before.status).toBe("draft");
  });

  test("rejection returns the unchanged brief and a reason", () => {
    const before = buildValidBrief();
    const r = transitionBriefStatus(before, {
      to: "generated",
      now: () => T1,
    });
    if (r.ok) throw new Error("expected rejection");
    expect(r.reason).toBe("to_status_not_legal_from_origin");
    expect(r.brief).toBe(before);
  });

  test("transition to 'failed' requires a failure arg", () => {
    const before = buildValidBrief({ status: "generating" });
    expect(() =>
      transitionBriefStatus(before, { to: "failed", now: () => T2 }),
    ).toThrow();
    const r = transitionBriefStatus(before, {
      to: "failed",
      now: () => T2,
      failure: { kind: "provider_error", message: "API timeout" },
    });
    if (!r.ok) throw new Error("expected ok");
    expect(r.brief.failureKind).toBe("provider_error");
    expect(r.brief.failureMessage).toBe("API timeout");
    expect(r.brief.finalisedAt).toBe(T2);
  });

  test("transition to 'generated' requires resultId", () => {
    const before = buildValidBrief({ status: "generating" });
    expect(() =>
      transitionBriefStatus(before, { to: "generated", now: () => T2 }),
    ).toThrow();
    const r = transitionBriefStatus(before, {
      to: "generated",
      now: () => T2,
      resultId: "result_42",
    });
    if (!r.ok) throw new Error("expected ok");
    expect(r.brief.resultId).toBe("result_42");
    expect(r.brief.finalisedAt).toBe(T2);
  });

  test("clears prior failureKind/Message when leaving 'failed' (only via obsolete)", () => {
    // From 'failed', only legal transition is to 'obsolete' (terminal).
    const before = buildValidBrief({
      status: "failed",
      failureKind: "internal_error",
      failureMessage: "earlier error",
      finalisedAt: T1,
    });
    const r = transitionBriefStatus(before, {
      to: "obsolete",
      now: () => T2,
    });
    if (!r.ok) throw new Error("expected ok");
    // 'obsolete' preserves prior failure context for audit, doesn't clear.
    expect(r.brief.failureKind).toBe("internal_error");
    expect(r.brief.finalisedAt).toBe(T2);
  });

  test("returned brief always parses against the schema", () => {
    const before = buildValidBrief({ status: "generating" });
    const r = transitionBriefStatus(before, {
      to: "generated",
      now: () => T2,
      resultId: "result_x",
    });
    if (!r.ok) throw new Error("expected ok");
    expect(GenerationBriefSchema.parse(r.brief)).toEqual(r.brief);
  });
});

/* -------------------------------------------------------------------------- */
/*                              recordFieldSource                             */
/* -------------------------------------------------------------------------- */

describe("recordFieldSource", () => {
  test("adds a new entry without mutating the input", () => {
    const before = buildValidBrief();
    const after = recordFieldSource(
      before,
      "copy.headline",
      "ai_edited",
      () => T1,
    );
    expect(after.fieldSources).toEqual({ "copy.headline": "ai_edited" });
    expect(before.fieldSources).toEqual({});
    expect(after.updatedAt).toBe(T1);
  });

  test("preserves existing entries", () => {
    const before = buildValidBrief({
      fieldSources: { "design.paletteMode": "user" },
    });
    const after = recordFieldSource(
      before,
      "copy.headline",
      "ai",
      () => T1,
    );
    expect(after.fieldSources).toEqual({
      "design.paletteMode": "user",
      "copy.headline": "ai",
    });
  });

  test("overwrites an existing entry on the same path", () => {
    const before = buildValidBrief({
      fieldSources: { "copy.headline": "ai" },
    });
    const after = recordFieldSource(
      before,
      "copy.headline",
      "ai_edited",
      () => T1,
    );
    expect(after.fieldSources["copy.headline"]).toBe("ai_edited");
  });
});

/* -------------------------------------------------------------------------- */
/*                              briefIdFor (deterministic)                    */
/* -------------------------------------------------------------------------- */

describe("briefIdFor", () => {
  test("is stable across calls for the same input", () => {
    const args = {
      runId: "run_001",
      scheduleEntryId: "se_007",
      formatId: "ig-feed-square",
    };
    expect(briefIdFor(args)).toBe(briefIdFor(args));
  });

  test("differs when any input differs", () => {
    const base = {
      runId: "run_001",
      scheduleEntryId: "se_007",
      formatId: "ig-feed-square",
    };
    expect(briefIdFor(base)).not.toBe(briefIdFor({ ...base, runId: "run_002" }));
    expect(briefIdFor(base)).not.toBe(
      briefIdFor({ ...base, scheduleEntryId: "se_008" }),
    );
    expect(briefIdFor(base)).not.toBe(
      briefIdFor({ ...base, formatId: "fb-feed-square" }),
    );
  });

  test("matches the expected format `brief_HHHHHHHH_HHHHHHHH_HHHHHHHH`", () => {
    const id = briefIdFor({
      runId: "run_001",
      scheduleEntryId: "se_007",
      formatId: "ig-feed-square",
    });
    expect(id).toMatch(/^brief_[0-9a-f]{8}_[0-9a-f]{8}_[0-9a-f]{8}$/);
  });
});

/* -------------------------------------------------------------------------- */
/*                              Predicates                                    */
/* -------------------------------------------------------------------------- */

describe("convenience predicates", () => {
  test("isReadyForGenerator only matches 'validated'", () => {
    for (const s of BRIEF_STATUSES) {
      expect(isReadyForGenerator(buildValidBrief({
        status: s,
        ...(["generated", "failed", "obsolete"].includes(s)
          ? { finalisedAt: T1 }
          : {}),
        ...(s === "generated" ? { resultId: "result_x" } : {}),
        ...(s === "failed"
          ? { failureKind: "internal_error", failureMessage: "x" }
          : {}),
      }))).toBe(s === "validated");
    }
  });

  test("isFinalised matches generated/failed/obsolete", () => {
    expect(
      isFinalised(
        buildValidBrief({
          status: "generated",
          resultId: "r",
          finalisedAt: T1,
        }),
      ),
    ).toBe(true);
    expect(
      isFinalised(
        buildValidBrief({
          status: "failed",
          failureKind: "internal_error",
          failureMessage: "x",
          finalisedAt: T1,
        }),
      ),
    ).toBe(true);
    expect(
      isFinalised(
        buildValidBrief({ status: "obsolete", finalisedAt: T1 }),
      ),
    ).toBe(true);
    expect(isFinalised(buildValidBrief({ status: "draft" }))).toBe(false);
    expect(isFinalised(buildValidBrief({ status: "validated" }))).toBe(false);
  });

  test("isPendingGenerator matches validated and generating", () => {
    expect(isPendingGenerator(buildValidBrief({ status: "validated" }))).toBe(
      true,
    );
    expect(isPendingGenerator(buildValidBrief({ status: "generating" }))).toBe(
      true,
    );
    expect(isPendingGenerator(buildValidBrief({ status: "draft" }))).toBe(false);
  });

  test("listAllBriefStatuses returns the canonical roster", () => {
    expect(listAllBriefStatuses()).toEqual(BRIEF_STATUSES);
  });
});
