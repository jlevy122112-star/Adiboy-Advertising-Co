/**
 * HTTP contracts for tenant-scoped brand intelligence profiles (Phase 1 persistence).
 *
 * Paths mirror `apps/api/src/brand-profile-server.ts` defaults.
 */

import { z } from "zod";

import { BrandIntelligenceProfileSchema } from "./brand-intelligence.js";

export const DEFAULT_BRAND_PROFILE_HTTP_PATH_UPSERT =
  "/api/marketer-pro/brand-profiles/upsert" as const;
export const DEFAULT_BRAND_PROFILE_HTTP_PATH_GET =
  "/api/marketer-pro/brand-profiles/get" as const;
export const DEFAULT_BRAND_PROFILE_HTTP_PATH_LIST =
  "/api/marketer-pro/brand-profiles/list" as const;

/** POST JSON — upsert one profile row keyed by (tenantId, profile.profileId). */
export const UpsertBrandProfileBodySchema = z
  .object({
    tenantId: z.string().min(1).max(120),
    profile: BrandIntelligenceProfileSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.tenantId !== data.profile.workspaceId) {
      ctx.addIssue({
        code: "custom",
        message:
          "tenantId must equal profile.workspaceId for tenant-scoped storage.",
        path: ["tenantId"],
      });
    }
  });

export type UpsertBrandProfileBody = z.infer<typeof UpsertBrandProfileBodySchema>;

export const GetBrandProfileQuerySchema = z
  .object({
    tenantId: z.string().min(1).max(120),
    profileId: z.string().min(1).max(120),
  })
  .strict();

export type GetBrandProfileQuery = z.infer<typeof GetBrandProfileQuerySchema>;

export const ListBrandProfilesQuerySchema = z
  .object({
    tenantId: z.string().min(1).max(120),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  })
  .strict();

export type ListBrandProfilesQuery = z.infer<typeof ListBrandProfilesQuerySchema>;
