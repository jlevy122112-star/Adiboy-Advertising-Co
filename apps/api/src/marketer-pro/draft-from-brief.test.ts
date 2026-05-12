import { describe, expect, it } from "vitest";

import {
  GenerationBriefSchema,
  appendAuditEntry,
  createAuditEntry,
  validateAuditEntryAgainstPoint,
} from "@home-link/marketer-pro-contract";

import {
  buildInitialOfferAuditLog,
  buildStubDraftBody,
} from "./draft-from-brief.js";
import { COPY_BODY_APPROVAL_POINT } from "./copy-draft-decision-point.js";

const T0 = "2026-05-10T12:00:00.000Z";

function minimalBrief() {
  return GenerationBriefSchema.parse({
    briefId: "brief_api_test",
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

describe("draft-from-brief (Phase 2 stub path)", () => {
  it("buildStubDraftBody includes headline and network", () => {
    const brief = minimalBrief();
    const body = buildStubDraftBody(brief);
    expect(body).toContain("instagram");
    expect(body).toContain("Summer drop is live");
    expect(body).toContain("brief_api_test");
  });

  it("buildStubDraftBody includes CTA when set", () => {
    const base = minimalBrief();
    const brief = GenerationBriefSchema.parse({
      ...base,
      copy: { ...base.copy, cta: "Shop now" },
    });
    const body = buildStubDraftBody(brief);
    expect(body).toContain("Shop now");
    expect(body).toContain("CTA:");
  });

  it("buildInitialOfferAuditLog yields one ai_suggestion_offered entry", () => {
    const brief = minimalBrief();
    const log = buildInitialOfferAuditLog(brief, T0);
    expect(log).toHaveLength(1);
    expect(log[0]!.kind).toBe("ai_suggestion_offered");
    expect(log[0]!.record).toBeNull();
    expect(log[0]!.decisionPointId).toBe(COPY_BODY_APPROVAL_POINT.id);
  });

  it("ai_suggestion_rejected appends after offer (human reject path)", () => {
    const brief = minimalBrief();
    const offerLog = buildInitialOfferAuditLog(brief, T0);
    const rejectEntry = createAuditEntry({
      entryId: "audit_rej_test",
      workspaceId: brief.workspaceId,
      kind: "ai_suggestion_rejected",
      target: { kind: "brief", id: brief.briefId, path: "copy.body" },
      decisionPointId: COPY_BODY_APPROVAL_POINT.id,
      record: null,
      alternativesOffered: [
        { optionId: "stub_primary", source: "ai", confidence: 0.72 },
      ],
      briefId: brief.briefId,
      createdAt: "2026-05-10T12:00:01.000Z",
      rationale: "User declined stub draft.",
    });
    expect(
      validateAuditEntryAgainstPoint(COPY_BODY_APPROVAL_POINT, rejectEntry),
    ).toEqual({ ok: true });
    const appended = appendAuditEntry(offerLog, rejectEntry);
    if (appended.ok) {
      expect(appended.log).toHaveLength(2);
      expect(appended.log[1]!.kind).toBe("ai_suggestion_rejected");
    } else {
      expect.fail(`appendAuditEntry failed: ${appended.reason}`);
    }
  });
});
