/**
 * HTTP-facing brand profile routes (Phase 1) — validate and delegate to Postgres.
 */

import {
  GetBrandProfileQuerySchema,
  ListBrandProfilesQuerySchema,
  UpsertBrandProfileBodySchema,
} from "@home-link/marketer-pro-contract";

import {
  getBrandProfile,
  listBrandProfilesByTenant,
  upsertBrandProfile,
} from "../db/brand-profile.js";

export type BrandProfileHttpSuccess<T> = {
  readonly ok: true;
  readonly status: number;
  readonly body: T;
};

export type BrandProfileHttpError = {
  readonly ok: false;
  readonly status: number;
  readonly body: unknown;
};

export type BrandProfileHttpOutcome =
  | BrandProfileHttpSuccess<unknown>
  | BrandProfileHttpError;

export async function executeUpsertBrandProfileRequest(
  body: unknown,
): Promise<BrandProfileHttpOutcome> {
  const parsed = UpsertBrandProfileBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "validation_error",
        message: parsed.error.message,
      },
    };
  }
  const { tenantId, profile } = parsed.data;
  const result = await upsertBrandProfile({ tenantId, profile });
  if (result.mode === "error") {
    if (result.code === "no_database") {
      return {
        ok: false,
        status: 503,
        body: {
          error: "database_required",
          message: result.message,
        },
      };
    }
    if (result.code === "invalid_profile_json") {
      return {
        ok: false,
        status: 400,
        body: { error: "invalid_profile", message: result.message },
      };
    }
    return {
      ok: false,
      status: 500,
      body: { error: "upsert_failed", message: result.message },
    };
  }
  return {
    ok: true,
    status: 200,
    body: { profile: result.profile },
  };
}

export async function executeGetBrandProfileRequestFromSearchParams(
  searchParams: URLSearchParams,
): Promise<BrandProfileHttpOutcome> {
  const parsed = GetBrandProfileQuerySchema.safeParse(
    Object.fromEntries(searchParams.entries()),
  );
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "validation_error",
        message: parsed.error.message,
      },
    };
  }
  const { tenantId, profileId } = parsed.data;
  const result = await getBrandProfile(tenantId, profileId);
  if (result.mode === "no_database") {
    return {
      ok: false,
      status: 503,
      body: {
        error: "database_required",
        message: "DATABASE_URL is not set; cannot load brand profiles.",
      },
    };
  }
  if (result.mode === "not_found") {
    return {
      ok: false,
      status: 404,
      body: { error: "not_found" },
    };
  }
  if (result.mode === "error") {
    return {
      ok: false,
      status: 500,
      body: { error: "load_failed", message: result.message ?? "unknown" },
    };
  }
  return {
    ok: true,
    status: 200,
    body: { profile: result.profile },
  };
}

export async function executeListBrandProfilesRequestFromSearchParams(
  searchParams: URLSearchParams,
): Promise<BrandProfileHttpOutcome> {
  const parsed = ListBrandProfilesQuerySchema.safeParse(
    Object.fromEntries(searchParams.entries()),
  );
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "validation_error",
        message: parsed.error.message,
      },
    };
  }
  const { tenantId, limit } = parsed.data;
  const result = await listBrandProfilesByTenant(tenantId, limit);
  if (result.mode === "no_database") {
    return {
      ok: false,
      status: 503,
      body: {
        error: "database_required",
        message: "DATABASE_URL is not set; cannot list brand profiles.",
      },
    };
  }
  if (result.mode === "error") {
    return {
      ok: false,
      status: 500,
      body: { error: "list_failed", message: result.message ?? "unknown" },
    };
  }
  return {
    ok: true,
    status: 200,
    body: { profiles: result.profiles },
  };
}
