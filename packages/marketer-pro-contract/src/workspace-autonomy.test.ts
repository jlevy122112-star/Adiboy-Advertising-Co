import { describe, expect, it } from "vitest";
import type { DecisionPoint, DecisionRecord } from "./decision-point.js";
import type { SocialConnection } from "./social-connections.js";
import {
  allowAutonomousAutoCommit,
  AutonomousJobRequestSchema,
  AutonomyModeSchema,
  AutonomyNotificationPolicySchema,
  DEFAULT_AUTONOMY_NOTIFICATION_POLICY,
  DEFAULT_AUTONOMY_POLICY,
  listMissingConnections,
  listPendingUserOnlyPoints,
  notificationChannelsFor,
  planAutonomousCommits,
  validateAutonomousJobPreconditions,
  WorkspaceAutonomyPolicySchema,
  type AutonomousJobRequest,
  type WorkspaceAutonomyPolicy,
} from "./workspace-autonomy.js";

const point = (id: string, overrides: Partial<DecisionPoint> = {}): DecisionPoint => ({
  id,
  stage: "design",
  label: id,
  controlMode: "ai_suggest_user_confirm",
  required: true,
  allowMultiSelect: false,
  allowCustomValue: false,
  allowRegenerate: true,
  allowSaveAsPreset: false,
  options: [],
  ...overrides,
});

const autonomousPolicy = (overrides: Partial<WorkspaceAutonomyPolicy> = {}): WorkspaceAutonomyPolicy => ({
  ...DEFAULT_AUTONOMY_POLICY,
  mode: "autonomous",
  ...overrides,
});

const igConnection: SocialConnection = {
  connectionId: "conn-ig",
  workspaceId: "w1",
  network: "instagram",
  accountId: "ig-1",
  accountHandle: "@brand",
  scopes: ["instagram_basic"],
  status: "active",
  connectedAt: "2026-04-01T00:00:00.000Z",
  connectedByUserId: "u1",
};

const baseRequest: AutonomousJobRequest = {
  workspaceId: "w1",
  requestedByUserId: "u1",
  platforms: ["instagram"],
  scope: "single_post",
};

describe("AutonomyModeSchema + WorkspaceAutonomyPolicySchema + AutonomyNotificationPolicySchema", () => {
  it("only allows the two documented autonomy modes", () => {
    expect(AutonomyModeSchema.safeParse("manual_review").success).toBe(true);
    expect(AutonomyModeSchema.safeParse("autonomous").success).toBe(true);
    expect(AutonomyModeSchema.safeParse("hybrid").success).toBe(false);
  });

  it("accepts the default policy and notification policy out-of-the-box", () => {
    expect(
      AutonomyNotificationPolicySchema.safeParse(
        DEFAULT_AUTONOMY_NOTIFICATION_POLICY,
      ).success,
    ).toBe(true);
    expect(
      WorkspaceAutonomyPolicySchema.safeParse(DEFAULT_AUTONOMY_POLICY).success,
    ).toBe(true);
  });

  it("ships first-publish-per-post enabled by default per product spec", () => {
    expect(DEFAULT_AUTONOMY_NOTIFICATION_POLICY.firstPublishPerPost).toBe(true);
  });
});

describe("AutonomousJobRequestSchema", () => {
  it("requires at least one platform", () => {
    const r = AutonomousJobRequestSchema.safeParse({
      ...baseRequest,
      platforms: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejects an unknown platform", () => {
    const r = AutonomousJobRequestSchema.safeParse({
      ...baseRequest,
      platforms: ["fake_network"],
    });
    expect(r.success).toBe(false);
  });

  it("only accepts the two scope values", () => {
    expect(
      AutonomousJobRequestSchema.safeParse({
        ...baseRequest,
        scope: "single_post",
      }).success,
    ).toBe(true);
    expect(
      AutonomousJobRequestSchema.safeParse({
        ...baseRequest,
        scope: "full_campaign",
      }).success,
    ).toBe(true);
    expect(
      AutonomousJobRequestSchema.safeParse({
        ...baseRequest,
        scope: "drip",
      }).success,
    ).toBe(false);
  });

  it("rejects an inverted publish window", () => {
    const r = AutonomousJobRequestSchema.safeParse({
      ...baseRequest,
      earliestPublishAt: "2026-06-01T00:00:00.000Z",
      latestPublishAt: "2026-05-01T00:00:00.000Z",
    });
    expect(r.success).toBe(false);
  });
});

describe("allowAutonomousAutoCommit — eligibility per control mode", () => {
  it("never auto-commits when mode is manual_review", () => {
    const policy: WorkspaceAutonomyPolicy = {
      ...DEFAULT_AUTONOMY_POLICY,
      mode: "manual_review",
    };
    expect(allowAutonomousAutoCommit("ai_with_optional_override", policy)).toBe(
      false,
    );
    expect(allowAutonomousAutoCommit("ai_suggest_user_confirm", policy)).toBe(
      false,
    );
  });

  it("auto-commits ai_with_optional_override + ai_suggest_user_confirm in autonomous mode", () => {
    const p = autonomousPolicy();
    expect(allowAutonomousAutoCommit("ai_with_optional_override", p)).toBe(true);
    expect(allowAutonomousAutoCommit("ai_suggest_user_confirm", p)).toBe(true);
  });

  it("never auto-commits user_only — even in autonomous mode", () => {
    expect(
      allowAutonomousAutoCommit("user_only", autonomousPolicy()),
    ).toBe(false);
    expect(
      allowAutonomousAutoCommit("user_only", autonomousPolicy({ autoCommitUserAssistedPoints: true })),
    ).toBe(false);
  });

  it("only auto-commits user_with_ai_assist when explicitly enabled", () => {
    expect(
      allowAutonomousAutoCommit("user_with_ai_assist", autonomousPolicy()),
    ).toBe(false);
    expect(
      allowAutonomousAutoCommit(
        "user_with_ai_assist",
        autonomousPolicy({ autoCommitUserAssistedPoints: true }),
      ),
    ).toBe(true);
  });
});

describe("planAutonomousCommits + listPendingUserOnlyPoints", () => {
  const catalog: DecisionPoint[] = [
    point("a.suggest", { controlMode: "ai_suggest_user_confirm" }),
    point("a.auto", { controlMode: "ai_with_optional_override" }),
    point("a.user-only", { controlMode: "user_only" }),
    point("a.assist", { controlMode: "user_with_ai_assist" }),
  ];

  it("plans every eligible point on a clean slate", () => {
    const plan = planAutonomousCommits(catalog, [], autonomousPolicy());
    expect(plan.map((p) => p.id).sort()).toEqual(["a.auto", "a.suggest"]);
  });

  it("is idempotent — never re-plans a point that already has a record", () => {
    const records: DecisionRecord[] = [
      {
        recordId: "r1",
        decisionPointId: "a.suggest",
        workspaceId: "w1",
        actorUserId: "u-ai",
        source: "ai",
        committedAt: "2026-05-10T05:00:00.000Z",
        chosenOptionId: null,
        value: "ok",
      },
    ];
    const plan = planAutonomousCommits(catalog, records, autonomousPolicy());
    expect(plan.map((p) => p.id)).toEqual(["a.auto"]);
  });

  it("lists user_only points that block the autonomous run", () => {
    const pending = listPendingUserOnlyPoints(catalog, []);
    expect(pending.map((p) => p.id)).toEqual(["a.user-only"]);
  });

  it("removes user_only points from the pending list once a record exists", () => {
    const records: DecisionRecord[] = [
      {
        recordId: "r1",
        decisionPointId: "a.user-only",
        workspaceId: "w1",
        actorUserId: "u1",
        source: "user",
        committedAt: "2026-05-10T05:00:00.000Z",
        chosenOptionId: null,
        value: "ok",
      },
    ];
    expect(listPendingUserOnlyPoints(catalog, records)).toEqual([]);
  });
});

describe("validateAutonomousJobPreconditions", () => {
  it("rejects when the plan does not allow autonomous mode", () => {
    const r = validateAutonomousJobPreconditions({
      request: baseRequest,
      policy: autonomousPolicy(),
      connections: [igConnection],
      canUseAutonomousMode: false,
    });
    expect(r).toEqual({
      ok: false,
      reason: "plan_does_not_allow_autonomous_mode",
    });
  });

  it("rejects when autonomy mode is not enabled in the policy", () => {
    const r = validateAutonomousJobPreconditions({
      request: baseRequest,
      policy: { ...DEFAULT_AUTONOMY_POLICY, mode: "manual_review" },
      connections: [igConnection],
      canUseAutonomousMode: true,
    });
    expect(r).toEqual({ ok: false, reason: "autonomy_mode_not_enabled" });
  });

  it("rejects when a requested platform has no connection", () => {
    const r = validateAutonomousJobPreconditions({
      request: { ...baseRequest, platforms: ["instagram", "linkedin"] },
      policy: autonomousPolicy(),
      connections: [igConnection],
      canUseAutonomousMode: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("platform_not_connected");
      expect(r.details).toEqual(["linkedin"]);
    }
  });

  it("rejects when the only connection for a platform is unusable (expired/revoked)", () => {
    const r = validateAutonomousJobPreconditions({
      request: baseRequest,
      policy: autonomousPolicy(),
      connections: [{ ...igConnection, status: "expired" }],
      canUseAutonomousMode: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("platform_connection_unusable");
      expect(r.details).toEqual(["instagram"]);
    }
  });

  it("returns ok when policy + plan + connections all line up", () => {
    const r = validateAutonomousJobPreconditions({
      request: baseRequest,
      policy: autonomousPolicy(),
      connections: [igConnection],
      canUseAutonomousMode: true,
    });
    expect(r).toEqual({ ok: true });
  });
});

describe("notificationChannelsFor", () => {
  it("emits configured channels when the reason is enabled", () => {
    const policy = autonomousPolicy();
    expect(notificationChannelsFor("first_publish_per_post", policy)).toEqual([
      "in_app",
      "email",
    ]);
  });

  it("returns no channels when the reason is disabled in the policy", () => {
    const policy = autonomousPolicy({
      notifications: {
        ...DEFAULT_AUTONOMY_NOTIFICATION_POLICY,
        firstPublishPerPost: false,
      },
    });
    expect(notificationChannelsFor("first_publish_per_post", policy)).toEqual(
      [],
    );
  });

  it("respects per-reason toggles independently", () => {
    const policy = autonomousPolicy({
      notifications: {
        firstPublishPerPost: true,
        decisionNeedsAttention: false,
        connectionNeedsReconnect: true,
        errorAlerts: false,
        dailySummary: true,
        channels: ["in_app"],
      },
    });
    expect(
      notificationChannelsFor("decision_needs_attention", policy),
    ).toEqual([]);
    expect(notificationChannelsFor("connection_needs_reconnect", policy)).toEqual(
      ["in_app"],
    );
    expect(notificationChannelsFor("daily_summary", policy)).toEqual(["in_app"]);
    expect(notificationChannelsFor("error_alert", policy)).toEqual([]);
  });
});

describe("listMissingConnections", () => {
  it("returns the platforms requested but not connected", () => {
    const missing = listMissingConnections(
      { ...baseRequest, platforms: ["instagram", "linkedin", "x"] },
      [igConnection],
    );
    expect(missing).toEqual(["linkedin", "x"]);
  });

  it("treats connections that are not usable as missing", () => {
    const missing = listMissingConnections(
      { ...baseRequest, platforms: ["instagram"] },
      [{ ...igConnection, status: "expired" }],
    );
    expect(missing).toEqual(["instagram"]);
  });

  it("returns an empty list when every requested platform is usably connected", () => {
    const missing = listMissingConnections(
      { ...baseRequest, platforms: ["instagram"] },
      [igConnection],
    );
    expect(missing).toEqual([]);
  });
});
