/**
 * Workspace-level autonomy mode.
 *
 * Layered on top of the four canonical control modes
 * ({@link ./decision-point.ts}). Autonomy mode does **not** add a fifth
 * control mode — every decision point still uses one of the four. What
 * autonomy mode changes is the *workflow* that drives commits:
 *
 * - In `manual_review` (default), nothing commits without the user.
 * - In `autonomous`, the AI auto-commits decisions whose control mode
 *   permits it (`ai_with_optional_override`, `ai_suggest_user_confirm`,
 *   `user_with_ai_assist`). `user_only` decisions are queued for the user;
 *   the autonomous job blocks until they're satisfied.
 *
 * The user's say is preserved because every committed record is editable
 * (the `DecisionRecord` history is append-only — see `commitDecision`).
 *
 * Trigger UX: the user picks (a) which platforms to publish to and
 * (b) whether this is a single post or a full campaign. That is the
 * entire input surface for autonomous mode. Everything else is generated
 * by the AI within the journey's decision points.
 *
 * Plan gating: autonomous mode is Pro/Enterprise only — see
 * {@link ./plan-entitlements.ts} `canUseAutonomousMode`.
 */

import { z } from "zod";
import {
  type DecisionControlMode,
  type DecisionPoint,
  type DecisionRecord,
} from "./decision-point.js";
import {
  isConnectionUsable,
  PublishableNetworkSchema,
  type PublishableNetwork,
  type SocialConnection,
} from "./social-connections.js";

/* -------------------------------------------------------------------------- */
/*                                Autonomy mode                               */
/* -------------------------------------------------------------------------- */

/**
 * The two workspace-level autonomy modes.
 *
 * - `manual_review` — every commit requires the user (the four control
 *   modes drive the UI as declared).
 * - `autonomous` — the AI auto-commits where the per-point control mode
 *   permits; `user_only` decisions are queued for the user.
 */
export const AutonomyModeSchema = z.enum(["manual_review", "autonomous"]);
export type AutonomyMode = z.infer<typeof AutonomyModeSchema>;

/* -------------------------------------------------------------------------- */
/*                              Notifications                                 */
/* -------------------------------------------------------------------------- */

export const NotificationChannelSchema = z.enum([
  "in_app",
  "email",
  "push",
  "sms",
]);
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

/**
 * Reasons the platform might notify the user during autonomous operation.
 *
 * - `first_publish_per_post` — required by the product spec: every
 *   post going live triggers a notification so the user knows.
 * - `decision_needs_attention` — AI hit a `user_only` decision point and
 *   needs the user.
 * - `connection_needs_reconnect` — token expired or revoked; user must
 *   reconnect before the autonomous job can resume.
 * - `error_alert` — non-recoverable publish error.
 * - `daily_summary` — rollup of the day's autonomous activity.
 */
export const NotificationReasonSchema = z.enum([
  "first_publish_per_post",
  "decision_needs_attention",
  "connection_needs_reconnect",
  "error_alert",
  "daily_summary",
]);
export type NotificationReason = z.infer<typeof NotificationReasonSchema>;

export const AutonomyNotificationPolicySchema = z
  .object({
    /** First time each scheduled post goes live → notify. Required = true by default. */
    firstPublishPerPost: z.boolean(),
    decisionNeedsAttention: z.boolean(),
    connectionNeedsReconnect: z.boolean(),
    errorAlerts: z.boolean(),
    dailySummary: z.boolean(),
    /** Channels each enabled reason fires on. Empty = no delivery. */
    channels: z.array(NotificationChannelSchema).max(4),
  })
  .strict();
export type AutonomyNotificationPolicy = z.infer<
  typeof AutonomyNotificationPolicySchema
>;

/**
 * Sane default; matches the product spec ("notify the user of first
 * notification on every post"). Treat as immutable — callers should clone
 * before mutating.
 */
export const DEFAULT_AUTONOMY_NOTIFICATION_POLICY: AutonomyNotificationPolicy = {
  firstPublishPerPost: true,
  decisionNeedsAttention: true,
  connectionNeedsReconnect: true,
  errorAlerts: true,
  dailySummary: false,
  channels: ["in_app", "email"],
};

/* -------------------------------------------------------------------------- */
/*                          Workspace autonomy policy                         */
/* -------------------------------------------------------------------------- */

export const WorkspaceAutonomyPolicySchema = z
  .object({
    mode: AutonomyModeSchema,
    /**
     * In autonomous mode, also auto-commit `user_with_ai_assist` decisions.
     * Off by default because those points typically expect the user as the
     * primary author; flipping this on says "go ahead, AI, draft for me
     * and I'll edit later".
     */
    autoCommitUserAssistedPoints: z.boolean(),
    /**
     * After autonomy commits a decision, optionally pause for explicit user
     * approval before continuing downstream stages. Off in autonomous mode
     * (the whole point is "AI does it all"); useful when a workspace wants
     * an "AI does the work but I sign off" flavour without flipping to
     * `manual_review`.
     */
    requireApprovalAfterAutonomousCommit: z.boolean(),
    notifications: AutonomyNotificationPolicySchema,
  })
  .strict();
export type WorkspaceAutonomyPolicy = z.infer<
  typeof WorkspaceAutonomyPolicySchema
>;

export const DEFAULT_AUTONOMY_POLICY: WorkspaceAutonomyPolicy = {
  mode: "manual_review",
  autoCommitUserAssistedPoints: false,
  requireApprovalAfterAutonomousCommit: false,
  notifications: DEFAULT_AUTONOMY_NOTIFICATION_POLICY,
};

/* -------------------------------------------------------------------------- */
/*                          Autonomous job request                            */
/* -------------------------------------------------------------------------- */

/**
 * The minimum input the user provides to kick off an autonomous run. Per
 * spec: pick platforms, pick scope (single post vs full campaign). The AI
 * does everything else — concept, copy, design, SEO, schedule, publish.
 *
 * Optional `seedPrompt` is a free-text "here's what I want to say" that
 * pre-populates the campaign brief; the AI fills it in if blank.
 */
export const AutonomousJobScopeSchema = z.enum(["single_post", "full_campaign"]);
export type AutonomousJobScope = z.infer<typeof AutonomousJobScopeSchema>;

export const AutonomousJobRequestSchema = z
  .object({
    workspaceId: z.string().min(1).max(120),
    requestedByUserId: z.string().min(1).max(120),
    /** Where to publish. Must be non-empty, all entries must be connected. */
    platforms: z.array(PublishableNetworkSchema).min(1).max(12),
    scope: AutonomousJobScopeSchema,
    /** Optional one-shot brief; AI fills in the gaps. */
    seedPrompt: z.string().max(8000).optional(),
    /** Optional hint at how many posts to plan for in `full_campaign`. */
    targetPostCount: z.number().int().min(1).max(100).optional(),
    /**
     * Optional ISO date range to schedule within. AI picks dates inside
     * the range. Falls back to "the next 30 days" when omitted.
     */
    earliestPublishAt: z.string().datetime().optional(),
    latestPublishAt: z.string().datetime().optional(),
  })
  .strict()
  .refine(
    (v) => {
      if (!v.earliestPublishAt || !v.latestPublishAt) return true;
      return Date.parse(v.earliestPublishAt) <= Date.parse(v.latestPublishAt);
    },
    { message: "earliestPublishAt must be <= latestPublishAt" },
  );
export type AutonomousJobRequest = z.infer<typeof AutonomousJobRequestSchema>;

/* -------------------------------------------------------------------------- */
/*                          Auto-commit eligibility                           */
/* -------------------------------------------------------------------------- */

/**
 * Whether a decision point at the given control mode is eligible for the
 * AI to auto-commit under the workspace's autonomy policy. Pure function;
 * decoupled from the specific point so callers can reason about modes
 * without instantiating points.
 */
export function allowAutonomousAutoCommit(
  controlMode: DecisionControlMode,
  policy: WorkspaceAutonomyPolicy,
): boolean {
  if (policy.mode !== "autonomous") return false;
  switch (controlMode) {
    case "ai_with_optional_override":
      return true;
    case "ai_suggest_user_confirm":
      return true;
    case "user_with_ai_assist":
      return policy.autoCommitUserAssistedPoints;
    case "user_only":
      return false;
  }
}

/**
 * Build the list of decision points the AI should auto-commit on this
 * autonomous pass. Filters out points already satisfied by an existing
 * record so calls are idempotent.
 */
export function planAutonomousCommits(
  catalog: ReadonlyArray<DecisionPoint>,
  records: ReadonlyArray<DecisionRecord>,
  policy: WorkspaceAutonomyPolicy,
): DecisionPoint[] {
  const satisfied = new Set(records.map((r) => r.decisionPointId));
  return catalog.filter(
    (p) =>
      !satisfied.has(p.id) && allowAutonomousAutoCommit(p.controlMode, policy),
  );
}

/**
 * Decision points blocking autonomous progress because they require the
 * user (control mode `user_only`) and have no committed record. The UI
 * surfaces these as a "needs your attention" queue.
 */
export function listPendingUserOnlyPoints(
  catalog: ReadonlyArray<DecisionPoint>,
  records: ReadonlyArray<DecisionRecord>,
): DecisionPoint[] {
  const satisfied = new Set(records.map((r) => r.decisionPointId));
  return catalog.filter(
    (p) => p.controlMode === "user_only" && !satisfied.has(p.id),
  );
}

/* -------------------------------------------------------------------------- */
/*                       Job preconditions (gate checks)                      */
/* -------------------------------------------------------------------------- */

/**
 * Tagged result from {@link validateAutonomousJobPreconditions}. The UI
 * branches on `reason` to render specific guidance ("Connect Instagram"
 * vs "Upgrade to Pro").
 */
export type AutonomousJobValidation =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "autonomy_mode_not_enabled"
        | "plan_does_not_allow_autonomous_mode"
        | "no_platforms_selected"
        | "platform_not_connected"
        | "platform_connection_unusable"
        | "scope_outside_request_window";
      details?: ReadonlyArray<string>;
    };

export interface ValidateAutonomousJobArgs {
  readonly request: AutonomousJobRequest;
  readonly policy: WorkspaceAutonomyPolicy;
  readonly connections: ReadonlyArray<SocialConnection>;
  readonly canUseAutonomousMode: boolean;
}

export function validateAutonomousJobPreconditions(
  args: ValidateAutonomousJobArgs,
): AutonomousJobValidation {
  const { request, policy, connections, canUseAutonomousMode } = args;
  if (!canUseAutonomousMode) {
    return { ok: false, reason: "plan_does_not_allow_autonomous_mode" };
  }
  if (policy.mode !== "autonomous") {
    return { ok: false, reason: "autonomy_mode_not_enabled" };
  }
  if (request.platforms.length === 0) {
    return { ok: false, reason: "no_platforms_selected" };
  }
  const missing: string[] = [];
  const unusable: string[] = [];
  for (const network of request.platforms) {
    const onNetwork = connections.filter((c) => c.network === network);
    if (onNetwork.length === 0) {
      missing.push(network);
      continue;
    }
    if (!onNetwork.some(isConnectionUsable)) {
      unusable.push(network);
    }
  }
  if (missing.length > 0) {
    return {
      ok: false,
      reason: "platform_not_connected",
      details: missing,
    };
  }
  if (unusable.length > 0) {
    return {
      ok: false,
      reason: "platform_connection_unusable",
      details: unusable,
    };
  }
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*                              Notifications                                 */
/* -------------------------------------------------------------------------- */

/**
 * Decide which notification channels (if any) should fire for a given
 * reason under the policy. Returns `[]` if the policy disabled this
 * reason. Pure — caller is responsible for actually dispatching.
 */
export function notificationChannelsFor(
  reason: NotificationReason,
  policy: WorkspaceAutonomyPolicy,
): NotificationChannel[] {
  const enabled = (() => {
    switch (reason) {
      case "first_publish_per_post":
        return policy.notifications.firstPublishPerPost;
      case "decision_needs_attention":
        return policy.notifications.decisionNeedsAttention;
      case "connection_needs_reconnect":
        return policy.notifications.connectionNeedsReconnect;
      case "error_alert":
        return policy.notifications.errorAlerts;
      case "daily_summary":
        return policy.notifications.dailySummary;
    }
  })();
  if (!enabled) return [];
  return [...policy.notifications.channels];
}

/**
 * Convenience: which platforms are still not connected for an autonomous
 * job request. Used by the UI to render "Connect Instagram" CTAs inline.
 */
export function listMissingConnections(
  request: AutonomousJobRequest,
  connections: ReadonlyArray<SocialConnection>,
): PublishableNetwork[] {
  const out: PublishableNetwork[] = [];
  for (const network of request.platforms) {
    const usable = connections.some(
      (c) => c.network === network && isConnectionUsable(c),
    );
    if (!usable) out.push(network);
  }
  return out;
}
