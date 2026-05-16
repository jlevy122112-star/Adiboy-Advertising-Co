/**
 * HTTP-facing branding routes — PUT (merge-update) and GET workspace branding.
 */

import { z } from "zod";
import { BrandingPutSchema } from "@home-link/marketer-pro-contract";
import { getWorkspaceBranding, upsertWorkspaceBranding } from "../db/workspace-branding.js";

type BrandingHttpSuccess<T> = { readonly ok: true; readonly status: number; readonly body: T };
type BrandingHttpError = { readonly ok: false; readonly status: number; readonly body: unknown };
export type BrandingHttpOutcome = BrandingHttpSuccess<unknown> | BrandingHttpError;

const PutBrandingBodySchema = z
  .object({
    tenantId: z.string().min(1).max(120),
    branding: BrandingPutSchema,
  })
  .strict();

const GetBrandingQuerySchema = z
  .object({ tenantId: z.string().min(1).max(120) })
  .strict();

export async function executePutBrandingRequest(
  body: unknown,
): Promise<BrandingHttpOutcome> {
  const parsed = PutBrandingBodySchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, status: 400, body: { error: "validation_error", message: parsed.error.message } };
  }
  const { tenantId, branding } = parsed.data;
  const result = await upsertWorkspaceBranding(tenantId, branding);
  if (!result.ok) {
    if (result.code === "no_database") {
      return { ok: false, status: 503, body: { error: "database_required", message: result.message } };
    }
    return { ok: false, status: 500, body: { error: "upsert_failed", message: result.message } };
  }
  return { ok: true, status: 200, body: { branding: result.branding } };
}

export async function executeGetBrandingRequestFromSearchParams(
  searchParams: URLSearchParams,
): Promise<BrandingHttpOutcome> {
  const parsed = GetBrandingQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) {
    return { ok: false, status: 400, body: { error: "validation_error", message: parsed.error.message } };
  }
  const result = await getWorkspaceBranding(parsed.data.tenantId);
  if (!result.ok) {
    if (result.code === "no_database") {
      return { ok: false, status: 503, body: { error: "database_required", message: result.message } };
    }
    if (result.code === "not_found") {
      return { ok: true, status: 200, body: { branding: {} } };
    }
    return { ok: false, status: 500, body: { error: "load_failed", message: result.message } };
  }
  return { ok: true, status: 200, body: { branding: result.branding } };
}
