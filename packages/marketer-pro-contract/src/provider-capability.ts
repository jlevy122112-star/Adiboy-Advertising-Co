/**
 * Provider capability contract — the static registry the autonomous
 * orchestrator queries to answer:
 *
 *   1. "I have a brief for (network=instagram, capability=image_generation).
 *      Which providers CAN do this?"
 *   2. "Of the providers that CAN, which one SHOULD we try first?"
 *
 * This module is **purely declarative** — no API calls, no health checks,
 * no authentication. Connection auth state lives on the workspace
 * connection records (see `social-connections.ts`). Runtime health and
 * circuit-breaker state belong to a future `ProviderHealth` record on the
 * workspace and are deliberately not modelled here.
 *
 * Three product invariants encoded here:
 *
 * 1. **Provider IDs are stable strings.** The catalog evolves additively —
 *    we never re-use a removed provider's id, and renaming one is a
 *    breaking contract change.
 *
 * 2. **Network coupling is per-capability.** A single provider can be
 *    capable of `image_generation` (no network attached) AND
 *    `social_publish` for `facebook` (network-scoped). Each capability
 *    row carries its own optional `network` field.
 *
 * 3. **Selection is deterministic.** Given the same registry and the
 *    same query, {@link rankCapableProviders} returns the same order.
 *    Random tie-breaking is forbidden; sort key is
 *    `(qualityTier desc, costTier asc, providerId asc)`. This makes
 *    autonomous runs reproducible across attempts and easy to test.
 */

import { z } from "zod";

import {
  PublishableNetworkSchema,
  type PublishableNetwork,
} from "./social-connections.js";

/* -------------------------------------------------------------------------- */
/*                              Provider catalog                              */
/* -------------------------------------------------------------------------- */

/**
 * Canonical provider identifiers. Additive only — once an id ships in a
 * release, it cannot be removed without a major bump.
 *
 * Generators (text / image / video):
 *   `openai` `anthropic` `stability_ai`
 *
 * Social publishers (one row per platform we own integrations for):
 *   `meta_graph` (Facebook + Instagram)
 *   `x_api` (Twitter / X)
 *   `linkedin_api` `youtube_api` `tiktok_api` `pinterest_api`
 *
 * Test/dev utility:
 *   `mock` — used in unit tests; never picked in production unless
 *   explicitly enabled by the caller.
 */
export const PROVIDER_IDS = [
  "openai",
  "anthropic",
  "stability_ai",
  "meta_graph",
  "x_api",
  "linkedin_api",
  "youtube_api",
  "tiktok_api",
  "pinterest_api",
  "mock",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];
export const ProviderIdSchema = z.enum(PROVIDER_IDS);

/* -------------------------------------------------------------------------- */
/*                           Capability vocabulary                            */
/* -------------------------------------------------------------------------- */

/**
 * What a provider can be asked to do. Capabilities are coarse-grained
 * intents — a request for `image_generation` does not specify model,
 * resolution, or style; those are brief-level concerns.
 *
 * Adding a new capability is additive and safe. Removing one is a
 * breaking change.
 */
export const PROVIDER_CAPABILITIES = [
  "text_generation",
  "image_generation",
  "image_editing",
  "social_publish",
  "social_schedule_native",
] as const;

export type ProviderCapability = (typeof PROVIDER_CAPABILITIES)[number];
export const ProviderCapabilitySchema = z.enum(PROVIDER_CAPABILITIES);

/** Capabilities that MUST be paired with a network (publish-side). */
const NETWORK_REQUIRED_CAPABILITIES: ReadonlySet<ProviderCapability> = new Set([
  "social_publish",
  "social_schedule_native",
]);

/** True when the capability requires a `network` to be valid. */
export function capabilityRequiresNetwork(c: ProviderCapability): boolean {
  return NETWORK_REQUIRED_CAPABILITIES.has(c);
}

/* -------------------------------------------------------------------------- */
/*                             Tier vocabularies                              */
/* -------------------------------------------------------------------------- */

/**
 * Coarse cost band. The orchestrator prefers cheaper providers when
 * everything else is equal. Exact dollar costs are workspace billing
 * concerns and live elsewhere.
 */
export const PROVIDER_COST_TIERS = [
  "free",
  "low",
  "mid",
  "high",
  "premium",
] as const;
export type ProviderCostTier = (typeof PROVIDER_COST_TIERS)[number];
export const ProviderCostTierSchema = z.enum(PROVIDER_COST_TIERS);

/** Numeric weight used by the selection sort. Lower = preferred. */
const COST_TIER_RANK: Readonly<Record<ProviderCostTier, number>> = Object.freeze({
  free: 0,
  low: 1,
  mid: 2,
  high: 3,
  premium: 4,
});

/**
 * Coarse quality / fidelity band. The orchestrator prefers higher
 * quality first, then breaks ties on cost.
 */
export const PROVIDER_QUALITY_TIERS = [
  "experimental",
  "standard",
  "premium",
] as const;
export type ProviderQualityTier = (typeof PROVIDER_QUALITY_TIERS)[number];
export const ProviderQualityTierSchema = z.enum(PROVIDER_QUALITY_TIERS);

/** Numeric weight used by the selection sort. Higher = preferred. */
const QUALITY_TIER_RANK: Readonly<Record<ProviderQualityTier, number>> =
  Object.freeze({
    experimental: 0,
    standard: 1,
    premium: 2,
  });

/* -------------------------------------------------------------------------- */
/*                            Auth method taxonomy                            */
/* -------------------------------------------------------------------------- */

/**
 * How a workspace must authenticate with this provider before it can
 * be used. Pure documentation — actual credential storage lives on the
 * workspace connection record.
 */
export const PROVIDER_AUTH_METHODS = [
  "api_key",
  "oauth2",
  "service_account",
  "platform_token",
  "none",
] as const;
export type ProviderAuthMethod = (typeof PROVIDER_AUTH_METHODS)[number];
export const ProviderAuthMethodSchema = z.enum(PROVIDER_AUTH_METHODS);

/* -------------------------------------------------------------------------- */
/*                       Provider capability record                           */
/* -------------------------------------------------------------------------- */

/**
 * One row in the capability matrix: "this provider, this capability,
 * this (optional) network, with these tier ratings". A provider may
 * appear in many rows.
 */
export const ProviderCapabilityRecordSchema = z
  .object({
    providerId: ProviderIdSchema,
    capability: ProviderCapabilitySchema,
    /**
     * Required for publish-side capabilities, forbidden otherwise. The
     * refinement below enforces this.
     */
    network: PublishableNetworkSchema.nullable(),
    qualityTier: ProviderQualityTierSchema,
    costTier: ProviderCostTierSchema,
    /**
     * Defaulted true. Toggled to false in the catalog when a provider
     * is in maintenance / under deprecation but its row hasn't yet
     * been removed.
     */
    enabled: z.boolean().default(true),
    authMethod: ProviderAuthMethodSchema,
    /**
     * Hard cap on requests per minute the provider's API will accept
     * for our usage tier. Used by the rate-limit budgeter.
     */
    rateLimitPerMinute: z.number().int().min(0).max(1_000_000),
    /** Hard cap on requests per day. `null` means no documented daily cap. */
    rateLimitPerDay: z.number().int().min(0).max(100_000_000).nullable(),
    /** Whether the provider exposes a true batch endpoint. */
    supportsBatch: z.boolean(),
    /**
     * Free-form notes the UI may surface to operators (e.g. "Beta — opt-in
     * required", "EU region only"). Kept short.
     */
    notes: z.string().max(280).default(""),
  })
  .strict()
  .refine(
    (r) => {
      const needs = capabilityRequiresNetwork(r.capability);
      return needs ? r.network !== null : r.network === null;
    },
    {
      message:
        "network is required for publish-side capabilities and forbidden otherwise",
      path: ["network"],
    },
  );
export type ProviderCapabilityRecord = z.infer<
  typeof ProviderCapabilityRecordSchema
>;

/* -------------------------------------------------------------------------- */
/*                       Default capability catalog                           */
/* -------------------------------------------------------------------------- */

/**
 * Helper that builds and freezes a capability row with sensible
 * defaults. Catalog authors only fill in the fields that matter.
 */
function row(
  partial: Omit<ProviderCapabilityRecord, "enabled" | "notes" | "network"> & {
    network?: PublishableNetwork | null;
    enabled?: boolean;
    notes?: string;
  },
): ProviderCapabilityRecord {
  const { network = null, enabled = true, notes = "", ...rest } = partial;
  return Object.freeze({ ...rest, network, enabled, notes });
}

/**
 * The seed capability matrix. This list is **additive only** between
 * minor releases. Removing or relabelling a row is a breaking change
 * and must be reviewed end-to-end.
 *
 * Each row answers: "which provider does what, on which network,
 * at what quality and cost".
 */
export const PROVIDER_CAPABILITY_CATALOG: ReadonlyArray<ProviderCapabilityRecord> =
  Object.freeze([
    /* ------------------------------ Generators ----------------------------- */
    row({
      providerId: "openai",
      capability: "text_generation",
      qualityTier: "premium",
      costTier: "mid",
      authMethod: "api_key",
      rateLimitPerMinute: 600,
      rateLimitPerDay: 1_000_000,
      supportsBatch: true,
    }),
    row({
      providerId: "openai",
      capability: "image_generation",
      qualityTier: "premium",
      costTier: "high",
      authMethod: "api_key",
      rateLimitPerMinute: 50,
      rateLimitPerDay: 5_000,
      supportsBatch: false,
    }),
    row({
      providerId: "openai",
      capability: "image_editing",
      qualityTier: "standard",
      costTier: "high",
      authMethod: "api_key",
      rateLimitPerMinute: 30,
      rateLimitPerDay: 3_000,
      supportsBatch: false,
    }),
    row({
      providerId: "anthropic",
      capability: "text_generation",
      qualityTier: "premium",
      costTier: "mid",
      authMethod: "api_key",
      rateLimitPerMinute: 400,
      rateLimitPerDay: 500_000,
      supportsBatch: true,
    }),
    row({
      providerId: "stability_ai",
      capability: "image_generation",
      qualityTier: "standard",
      costTier: "low",
      authMethod: "api_key",
      rateLimitPerMinute: 150,
      rateLimitPerDay: 50_000,
      supportsBatch: false,
    }),
    row({
      providerId: "stability_ai",
      capability: "image_editing",
      qualityTier: "standard",
      costTier: "low",
      authMethod: "api_key",
      rateLimitPerMinute: 100,
      rateLimitPerDay: 30_000,
      supportsBatch: false,
    }),

    /* ----------------------------- Social publish -------------------------- */
    row({
      providerId: "meta_graph",
      capability: "social_publish",
      network: "facebook",
      qualityTier: "standard",
      costTier: "free",
      authMethod: "oauth2",
      rateLimitPerMinute: 200,
      rateLimitPerDay: 100_000,
      supportsBatch: false,
    }),
    row({
      providerId: "meta_graph",
      capability: "social_schedule_native",
      network: "facebook",
      qualityTier: "standard",
      costTier: "free",
      authMethod: "oauth2",
      rateLimitPerMinute: 200,
      rateLimitPerDay: 100_000,
      supportsBatch: false,
    }),
    row({
      providerId: "meta_graph",
      capability: "social_publish",
      network: "instagram",
      qualityTier: "standard",
      costTier: "free",
      authMethod: "oauth2",
      rateLimitPerMinute: 200,
      rateLimitPerDay: 100_000,
      supportsBatch: false,
    }),
    row({
      providerId: "x_api",
      capability: "social_publish",
      network: "x",
      qualityTier: "standard",
      costTier: "free",
      authMethod: "oauth2",
      rateLimitPerMinute: 50,
      rateLimitPerDay: 10_000,
      supportsBatch: false,
    }),
    row({
      providerId: "linkedin_api",
      capability: "social_publish",
      network: "linkedin",
      qualityTier: "standard",
      costTier: "free",
      authMethod: "oauth2",
      rateLimitPerMinute: 100,
      rateLimitPerDay: 50_000,
      supportsBatch: false,
    }),
    row({
      providerId: "youtube_api",
      capability: "social_publish",
      network: "youtube",
      qualityTier: "standard",
      costTier: "free",
      authMethod: "oauth2",
      rateLimitPerMinute: 60,
      rateLimitPerDay: 10_000,
      supportsBatch: false,
    }),
    row({
      providerId: "tiktok_api",
      capability: "social_publish",
      network: "tiktok",
      qualityTier: "standard",
      costTier: "free",
      authMethod: "oauth2",
      rateLimitPerMinute: 60,
      rateLimitPerDay: 10_000,
      supportsBatch: false,
    }),
    row({
      providerId: "pinterest_api",
      capability: "social_publish",
      network: "pinterest",
      qualityTier: "standard",
      costTier: "free",
      authMethod: "oauth2",
      rateLimitPerMinute: 100,
      rateLimitPerDay: 30_000,
      supportsBatch: false,
    }),

    /* ----------------------------- Test / mock ----------------------------- */
    row({
      providerId: "mock",
      capability: "text_generation",
      qualityTier: "experimental",
      costTier: "free",
      authMethod: "none",
      rateLimitPerMinute: 1_000_000,
      rateLimitPerDay: null,
      supportsBatch: true,
      notes: "Unit-test only. Disabled by default in production.",
      enabled: false,
    }),
    row({
      providerId: "mock",
      capability: "image_generation",
      qualityTier: "experimental",
      costTier: "free",
      authMethod: "none",
      rateLimitPerMinute: 1_000_000,
      rateLimitPerDay: null,
      supportsBatch: true,
      notes: "Unit-test only. Disabled by default in production.",
      enabled: false,
    }),
  ]);

/* -------------------------------------------------------------------------- */
/*                                 Lookups                                    */
/* -------------------------------------------------------------------------- */

/**
 * All capability rows for a single provider. Returns a frozen array
 * (may be empty if the provider has no rows in the registry — should
 * never happen for shipped provider ids, but safe to call).
 */
export function getProviderCapabilities(
  providerId: ProviderId,
  registry: ReadonlyArray<ProviderCapabilityRecord> = PROVIDER_CAPABILITY_CATALOG,
): ReadonlyArray<ProviderCapabilityRecord> {
  return registry.filter((r) => r.providerId === providerId);
}

/**
 * Distinct list of capabilities a provider supports (across all
 * networks). Useful for UI badges like "OpenAI: text, image".
 */
export function listCapabilitiesOf(
  providerId: ProviderId,
  registry: ReadonlyArray<ProviderCapabilityRecord> = PROVIDER_CAPABILITY_CATALOG,
): ReadonlyArray<ProviderCapability> {
  const rows = getProviderCapabilities(providerId, registry);
  const seen = new Set<ProviderCapability>();
  for (const r of rows) seen.add(r.capability);
  return Array.from(seen);
}

/** Query shape accepted by the capability lookups and selection helpers. */
export interface CapabilityQuery {
  readonly capability: ProviderCapability;
  /**
   * Required when `capability` is a publish-side capability
   * (`social_publish` / `social_schedule_native`). Forbidden otherwise.
   * The lookup throws on misuse so callers can't silently mismatch.
   */
  readonly network?: PublishableNetwork | null;
  /**
   * When true, includes rows where `enabled` is false. Defaults to false
   * — the orchestrator never picks disabled rows by accident.
   */
  readonly includeDisabled?: boolean;
}

function assertQueryShape(q: CapabilityQuery): void {
  const needs = capabilityRequiresNetwork(q.capability);
  const has = q.network !== undefined && q.network !== null;
  if (needs && !has) {
    throw new Error(
      `capability '${q.capability}' requires a network in the query`,
    );
  }
  if (!needs && has) {
    throw new Error(
      `capability '${q.capability}' is network-agnostic; query must not pass a network`,
    );
  }
}

/**
 * All rows that match `(capability, network?)`. Disabled rows are
 * filtered out unless `includeDisabled` is true. Order is the registry's
 * declaration order — call {@link rankCapableProviders} for a sorted
 * preference list.
 */
export function findCapableProviders(
  query: CapabilityQuery,
  registry: ReadonlyArray<ProviderCapabilityRecord> = PROVIDER_CAPABILITY_CATALOG,
): ReadonlyArray<ProviderCapabilityRecord> {
  assertQueryShape(query);
  const wantNetwork = query.network ?? null;
  const includeDisabled = query.includeDisabled === true;
  return registry.filter(
    (r) =>
      r.capability === query.capability &&
      r.network === wantNetwork &&
      (includeDisabled || r.enabled),
  );
}

/**
 * True when `providerId` has an enabled row for the given query.
 * Convenience wrapper around {@link findCapableProviders}.
 */
export function providerSupports(
  providerId: ProviderId,
  query: CapabilityQuery,
  registry: ReadonlyArray<ProviderCapabilityRecord> = PROVIDER_CAPABILITY_CATALOG,
): boolean {
  return findCapableProviders(query, registry).some(
    (r) => r.providerId === providerId,
  );
}

/* -------------------------------------------------------------------------- */
/*                           Deterministic selection                          */
/* -------------------------------------------------------------------------- */

/**
 * Compares two rows and returns negative when `a` is preferred. The sort
 * key is `(qualityTier desc, costTier asc, providerId asc)` — three
 * deterministic levels with no random tie-breaking.
 *
 * Exposed for callers that want to rank a custom subset of rows
 * (e.g. after filtering by workspace-level provider allow-lists).
 */
export function compareCapabilityRecords(
  a: ProviderCapabilityRecord,
  b: ProviderCapabilityRecord,
): number {
  const qDiff = QUALITY_TIER_RANK[b.qualityTier] - QUALITY_TIER_RANK[a.qualityTier];
  if (qDiff !== 0) return qDiff;
  const cDiff = COST_TIER_RANK[a.costTier] - COST_TIER_RANK[b.costTier];
  if (cDiff !== 0) return cDiff;
  return a.providerId.localeCompare(b.providerId);
}

/**
 * Capable providers for the query, sorted by preference. This is the
 * function the autonomous orchestrator calls when picking which API
 * to try first; iteration order = retry order.
 */
export function rankCapableProviders(
  query: CapabilityQuery,
  registry: ReadonlyArray<ProviderCapabilityRecord> = PROVIDER_CAPABILITY_CATALOG,
): ReadonlyArray<ProviderCapabilityRecord> {
  return [...findCapableProviders(query, registry)].sort(
    compareCapabilityRecords,
  );
}

/**
 * Top-ranked capable provider, or `null` when none can serve the
 * query. Pure convenience for the common single-pick case.
 */
export function selectFirstCapableProvider(
  query: CapabilityQuery,
  registry: ReadonlyArray<ProviderCapabilityRecord> = PROVIDER_CAPABILITY_CATALOG,
): ProviderCapabilityRecord | null {
  const ranked = rankCapableProviders(query, registry);
  return ranked.length > 0 ? ranked[0]! : null;
}

/* -------------------------------------------------------------------------- */
/*                              Read helpers                                  */
/* -------------------------------------------------------------------------- */

/** All known provider ids (for UI dropdowns, validation, etc.). */
export function listAllProviders(): ReadonlyArray<ProviderId> {
  return PROVIDER_IDS;
}

/** All known capabilities (for UI dropdowns, validation, etc.). */
export function listAllCapabilities(): ReadonlyArray<ProviderCapability> {
  return PROVIDER_CAPABILITIES;
}

/**
 * Distinct list of provider ids that appear in `registry`. Useful when
 * a workspace has a subset registry and you want to enumerate it.
 */
export function listProvidersInRegistry(
  registry: ReadonlyArray<ProviderCapabilityRecord> = PROVIDER_CAPABILITY_CATALOG,
): ReadonlyArray<ProviderId> {
  const seen = new Set<ProviderId>();
  for (const r of registry) seen.add(r.providerId);
  return Array.from(seen);
}
