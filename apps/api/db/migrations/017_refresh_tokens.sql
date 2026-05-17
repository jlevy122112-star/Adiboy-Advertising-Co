-- Phase 8: JWT refresh tokens (stored as hashes — never plaintext)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  user_id    TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id  TEXT        NOT NULL,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx   ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_token_hash_idx ON refresh_tokens (token_hash);
