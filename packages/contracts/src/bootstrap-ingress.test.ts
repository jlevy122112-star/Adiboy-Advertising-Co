import { describe, expect, it } from "vitest";
import {
  IngressValidationError,
  parseBootstrapTenantContext,
} from "./bootstrap-ingress.js";

describe("parseBootstrapTenantContext", () => {
  it("returns tenant context when headers are valid", () => {
    const ctx = parseBootstrapTenantContext(
      {
        "x-home-link-tenant-id": "t-1",
        "x-home-link-user-id": "u-1",
        "x-home-link-actor-role": "tenant_admin",
      },
      { requestId: "r-1", source: "api" },
    );

    expect(ctx).toEqual({
      tenantId: "t-1",
      actorUserId: "u-1",
      actorRole: "tenant_admin",
      requestId: "r-1",
      source: "api",
    });
  });

  it("defaults source to api", () => {
    const ctx = parseBootstrapTenantContext(
      {
        "x-home-link-tenant-id": "t-1",
        "x-home-link-user-id": "u-1",
        "x-home-link-actor-role": "readonly_analyst",
      },
      { requestId: "r-2" },
    );
    expect(ctx.source).toBe("api");
  });

  it("throws when tenant id is missing", () => {
    expect(() =>
      parseBootstrapTenantContext(
        {
          "x-home-link-user-id": "u-1",
          "x-home-link-actor-role": "tenant_admin",
        },
        { requestId: "r-1" },
      ),
    ).toThrow(IngressValidationError);
    expect(() =>
      parseBootstrapTenantContext(
        {
          "x-home-link-user-id": "u-1",
          "x-home-link-actor-role": "tenant_admin",
        },
        { requestId: "r-1" },
      ),
    ).toThrow(/x-home-link-tenant-id/);
  });

  it("throws when user id is missing", () => {
    expect(() =>
      parseBootstrapTenantContext(
        {
          "x-home-link-tenant-id": "t-1",
          "x-home-link-actor-role": "tenant_admin",
        },
        { requestId: "r-1" },
      ),
    ).toThrow(/x-home-link-user-id/);
  });

  it("throws when role is unknown", () => {
    expect(() =>
      parseBootstrapTenantContext(
        {
          "x-home-link-tenant-id": "t-1",
          "x-home-link-user-id": "u-1",
          "x-home-link-actor-role": "not_a_role",
        },
        { requestId: "r-1" },
      ),
    ).toThrow(/Unknown actor role/);
  });
});
