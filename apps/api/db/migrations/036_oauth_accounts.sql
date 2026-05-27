-- SSO provider accounts linked to users (Google, Apple)
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id         TEXT        NOT NULL,
  provider          TEXT        NOT NULL CHECK (provider IN ('google', 'apple')),
  provider_id       TEXT        NOT NULL,   -- Google `sub` or Apple `sub`
  provider_email    TEXT,                   -- email from the provider (may differ from login email)
  display_name      TEXT,
  avatar_url        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user ON oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider_email ON oauth_accounts(provider, provider_email);

COMMENT ON TABLE oauth_accounts IS
  'One row per (provider, provider_id) pair. A user may have both Google and Apple linked.';
