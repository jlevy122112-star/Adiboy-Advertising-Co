-- Phase 1 — tenant-scoped brand intelligence profiles (JSON document per profile id).

CREATE TABLE IF NOT EXISTS brand_profiles (
  tenant_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  body JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, profile_id)
);

CREATE INDEX IF NOT EXISTS brand_profiles_tenant_updated_idx
  ON brand_profiles (tenant_id, updated_at DESC);
