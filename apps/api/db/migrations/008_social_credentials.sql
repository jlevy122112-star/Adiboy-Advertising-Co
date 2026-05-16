-- Phase 5 — OAuth credential storage per tenant per network.
-- Tokens are stored in plaintext; encrypt at rest (e.g. pgcrypto / KMS) before production use.
CREATE TABLE IF NOT EXISTS social_credentials (
  tenant_id        TEXT        NOT NULL,
  network          TEXT        NOT NULL,  -- 'meta' | 'x' | 'linkedin' | 'tiktok' | 'instagram' | 'youtube'
  access_token     TEXT        NOT NULL,
  token_secret     TEXT,                  -- OAuth 1.0a only (X legacy)
  expires_at       TIMESTAMPTZ,           -- NULL = non-expiring token
  -- Network-specific extras: pageId, igUserId, authorUrn, openId, etc.
  metadata         JSONB       NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, network)
);

COMMENT ON TABLE social_credentials IS
  'Stores per-tenant OAuth tokens for outbound social publishing. One row per (tenant, network) pair.';
COMMENT ON COLUMN social_credentials.metadata IS
  'Network-specific fields: Meta → {pageId, igUserId}; LinkedIn → {authorUrn}; TikTok → {openId}.';
