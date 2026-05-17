-- Phase 8: user accounts
CREATE TABLE IF NOT EXISTS users (
  id            TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  tenant_id     TEXT        NOT NULL,
  email         TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  email_verified BOOLEAN    NOT NULL DEFAULT false,
  role          TEXT        NOT NULL DEFAULT 'member',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS users_tenant_id_idx ON users (tenant_id);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
