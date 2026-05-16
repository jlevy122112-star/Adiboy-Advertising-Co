-- Workspace-level settings table (white-label branding, etc.).
-- branding_json mirrors WorkspaceBrandingSchema in the contract.
CREATE TABLE IF NOT EXISTS workspaces (
  tenant_id     TEXT         NOT NULL PRIMARY KEY,
  branding_json JSONB        NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE workspaces IS
  'One row per tenant for workspace-level configuration (branding, feature flags, etc.).';
COMMENT ON COLUMN workspaces.branding_json IS
  'WorkspaceBranding shape: displayName, tagline, logoUrl, primaryHex, accentHex, businessCategoryId.';
