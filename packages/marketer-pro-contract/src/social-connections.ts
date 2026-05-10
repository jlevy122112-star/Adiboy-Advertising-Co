/**
 * Social-account connection contracts.
 *
 * Owners run this app to publish on networks they own — Instagram pages,
 * LinkedIn company pages, YouTube channels, TikTok creator accounts, etc.
 * Each connection is a {workspace, network, account} triple plus the OAuth
 * grant we need to publish on the user's behalf.
 *
 * This module defines **only** the data contract. The OAuth flow (PKCE,
 * redirect handlers, token storage, refresh scheduling) lives in `apps/api`
 * — see `apps/api/src/social/oauth/*` (one file per network) for that.
 *
 * Two product invariants encoded here:
 *
 * 1. **Picking which connection to publish from is `user_only`.** When a
 *    workspace has more than one Instagram account, the AI never silently
 *    picks. The decision point `connection.target` enforces this.
 * 2. **Autonomous mode cannot publish to a network that isn't connected.**
 *    See `workspace-autonomy.ts` `validateAutonomousJobPreconditions`.
 */

import { z } from "zod";
import type { ContentAssetNetwork } from "./content-asset-formats.js";
import type { ContentAssetMedium } from "./content-asset-formats.js";

/* -------------------------------------------------------------------------- */
/*                            Publishable networks                            */
/* -------------------------------------------------------------------------- */

/**
 * Networks the app actually publishes to via OAuth. A subset of
 * {@link ContentAssetNetwork}; e.g. `email`, `print`, `web` are
 * export-only and never require a connection.
 */
export const PUBLISHABLE_NETWORKS = [
  "facebook",
  "instagram",
  "x",
  "linkedin",
  "youtube",
  "tiktok",
  "pinterest",
  "snapchat",
  "reddit",
  "threads",
  "discord",
  "twitch",
] as const satisfies ReadonlyArray<ContentAssetNetwork>;

export type PublishableNetwork = (typeof PUBLISHABLE_NETWORKS)[number];

export const PublishableNetworkSchema = z.enum(PUBLISHABLE_NETWORKS);

/* -------------------------------------------------------------------------- */
/*                        Connection capability registry                      */
/* -------------------------------------------------------------------------- */

/**
 * What a granted connection on a given network is *capable of doing*. This
 * is a static registry keyed by network — it describes what the platform
 * itself supports through its API, **not** what the specific account has
 * been granted (the granted scopes live on the connection record). The
 * UI uses this to enable/disable autonomous-mode toggles per platform.
 */
export interface NetworkCapabilities {
  readonly network: PublishableNetwork;
  readonly canSchedule: boolean;
  readonly mediaTypes: ReadonlyArray<ContentAssetMedium>;
  /** Whether the network requires a business / creator account (vs personal). */
  readonly requiresBusinessAccount: boolean;
  /** Whether the network exposes per-post analytics for our reporting. */
  readonly exposesAnalytics: boolean;
}

const cap = (c: NetworkCapabilities): NetworkCapabilities => Object.freeze(c);

export const NETWORK_CAPABILITIES: Readonly<
  Record<PublishableNetwork, NetworkCapabilities>
> = Object.freeze({
  facebook: cap({
    network: "facebook",
    canSchedule: true,
    mediaTypes: ["image", "video", "gif", "animated_image"],
    requiresBusinessAccount: false,
    exposesAnalytics: true,
  }),
  instagram: cap({
    network: "instagram",
    canSchedule: true,
    mediaTypes: ["image", "video"],
    requiresBusinessAccount: true,
    exposesAnalytics: true,
  }),
  x: cap({
    network: "x",
    canSchedule: true,
    mediaTypes: ["image", "video", "gif"],
    requiresBusinessAccount: false,
    exposesAnalytics: true,
  }),
  linkedin: cap({
    network: "linkedin",
    canSchedule: true,
    mediaTypes: ["image", "video"],
    requiresBusinessAccount: false,
    exposesAnalytics: true,
  }),
  youtube: cap({
    network: "youtube",
    canSchedule: true,
    mediaTypes: ["video", "image"],
    requiresBusinessAccount: false,
    exposesAnalytics: true,
  }),
  tiktok: cap({
    network: "tiktok",
    canSchedule: true,
    mediaTypes: ["video", "image"],
    requiresBusinessAccount: false,
    exposesAnalytics: true,
  }),
  pinterest: cap({
    network: "pinterest",
    canSchedule: true,
    mediaTypes: ["image", "video"],
    requiresBusinessAccount: false,
    exposesAnalytics: true,
  }),
  snapchat: cap({
    network: "snapchat",
    canSchedule: true,
    mediaTypes: ["image", "video"],
    requiresBusinessAccount: true,
    exposesAnalytics: true,
  }),
  reddit: cap({
    network: "reddit",
    canSchedule: false,
    mediaTypes: ["image", "video"],
    requiresBusinessAccount: false,
    exposesAnalytics: false,
  }),
  threads: cap({
    network: "threads",
    canSchedule: true,
    mediaTypes: ["image", "video"],
    requiresBusinessAccount: false,
    exposesAnalytics: true,
  }),
  discord: cap({
    network: "discord",
    canSchedule: false,
    mediaTypes: ["image", "video", "gif"],
    requiresBusinessAccount: false,
    exposesAnalytics: false,
  }),
  twitch: cap({
    network: "twitch",
    canSchedule: false,
    mediaTypes: ["image", "video"],
    requiresBusinessAccount: false,
    exposesAnalytics: false,
  }),
});

/* -------------------------------------------------------------------------- */
/*                            Connection record                               */
/* -------------------------------------------------------------------------- */

/**
 * Lifecycle state of a connection. Transitions:
 *
 * - `active` — token valid; healthy publishes.
 * - `expired` — token expired; user must reconnect.
 * - `revoked` — user removed the app on the network or disconnected here.
 * - `error` — last publish/refresh hit a non-token failure (rate limit,
 *   permission missing, network outage). UI shows a banner with details.
 */
export const ConnectionStatusSchema = z.enum([
  "active",
  "expired",
  "revoked",
  "error",
]);
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;

/**
 * One connected social account at a workspace. Tokens themselves never
 * leave the API server — `accessTokenRef` is an opaque pointer (e.g. a
 * KMS key id) the API can dereference. The contract carries everything
 * the UI needs to show "Instagram · @brandname · expires May 2026".
 */
export const SocialConnectionSchema = z
  .object({
    connectionId: z.string().min(1).max(120),
    workspaceId: z.string().min(1).max(120),
    network: PublishableNetworkSchema,
    /** Stable id from the network (e.g. IG user-id). Used for posting. */
    accountId: z.string().min(1).max(256),
    /** Display handle ("@brand"); shown in UI. */
    accountHandle: z.string().min(1).max(256),
    accountAvatarUrl: z.string().url().optional(),
    /** OAuth scopes granted by the user. */
    scopes: z.array(z.string().max(120)).max(64),
    /** Connection status; see {@link ConnectionStatusSchema}. */
    status: ConnectionStatusSchema,
    /** ISO-8601 timestamp the connection was created. */
    connectedAt: z.string().datetime(),
    /** ISO-8601 timestamp the access token expires; null/undefined for non-expiring grants. */
    expiresAt: z.string().datetime().nullable().optional(),
    /** Last error message if `status === "error"`, free-form. */
    lastError: z.string().max(2000).optional(),
    /** User who initiated the connection. */
    connectedByUserId: z.string().min(1).max(120),
    /** Opaque pointer to the access token's secure storage; never the token itself. */
    accessTokenRef: z.string().min(1).max(512).optional(),
  })
  .strict();

export type SocialConnection = z.infer<typeof SocialConnectionSchema>;

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

/** True when the connection can currently publish. */
export function isConnectionUsable(c: SocialConnection): boolean {
  return c.status === "active";
}

/**
 * True when the connection needs the user to reconnect (token expired or
 * revoked, or expiring within `withinMs` of `now`).
 */
export function needsReconnect(
  c: SocialConnection,
  now: Date = new Date(),
  withinMs: number = 0,
): boolean {
  if (c.status === "expired" || c.status === "revoked") return true;
  if (c.status === "error") return true;
  if (!c.expiresAt) return false;
  const expiresMs = Date.parse(c.expiresAt);
  return expiresMs - now.getTime() <= withinMs;
}

/** Filter to the connections usable for publishing on the given network. */
export function findUsableConnectionsForNetwork(
  network: PublishableNetwork,
  connections: ReadonlyArray<SocialConnection>,
): SocialConnection[] {
  return connections.filter(
    (c) => c.network === network && isConnectionUsable(c),
  );
}

/**
 * The networks a workspace currently has at least one usable connection
 * for. Drives the "platforms you can publish to" picker in the UI.
 */
export function listConnectedNetworks(
  connections: ReadonlyArray<SocialConnection>,
): PublishableNetwork[] {
  const out = new Set<PublishableNetwork>();
  for (const c of connections) {
    if (isConnectionUsable(c)) out.add(c.network);
  }
  return Array.from(out).sort() as PublishableNetwork[];
}

/**
 * Validate that a publish target — network + optional accountId — is
 * actually usable. Returns the connection on success, or a tagged failure
 * the UI can render verbatim.
 */
export type ResolveTargetResult =
  | { ok: true; connection: SocialConnection }
  | {
      ok: false;
      reason:
        | "no_connection_for_network"
        | "no_usable_connection_for_network"
        | "ambiguous_account_choice"
        | "unknown_account_id";
    };

export function resolvePublishTarget(args: {
  readonly network: PublishableNetwork;
  readonly connections: ReadonlyArray<SocialConnection>;
  /** When the workspace has >1 account on the network, the user must specify which. */
  readonly accountId?: string;
}): ResolveTargetResult {
  const { network, connections, accountId } = args;
  const onNetwork = connections.filter((c) => c.network === network);
  if (onNetwork.length === 0) {
    return { ok: false, reason: "no_connection_for_network" };
  }
  const usable = onNetwork.filter(isConnectionUsable);
  if (usable.length === 0) {
    return { ok: false, reason: "no_usable_connection_for_network" };
  }
  if (accountId) {
    const match = usable.find((c) => c.accountId === accountId);
    if (!match) return { ok: false, reason: "unknown_account_id" };
    return { ok: true, connection: match };
  }
  if (usable.length > 1) {
    return { ok: false, reason: "ambiguous_account_choice" };
  }
  return { ok: true, connection: usable[0] };
}
