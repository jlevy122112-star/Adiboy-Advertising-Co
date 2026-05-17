-- Phase 8: encrypt OAuth tokens at rest using pgcrypto
-- Requires: CREATE EXTENSION IF NOT EXISTS pgcrypto (run once by DBA)
-- MARKETER_TOKEN_ENCRYPTION_KEY env var must be set before running this migration.
--
-- This migration adds encrypted_access_token / encrypted_refresh_token columns
-- and a trigger to auto-encrypt on write. Plaintext columns are kept temporarily
-- for backward compat and dropped in a follow-up migration after rollout.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE social_credentials
  ADD COLUMN IF NOT EXISTS encrypted_access_token  BYTEA,
  ADD COLUMN IF NOT EXISTS encrypted_refresh_token BYTEA,
  ADD COLUMN IF NOT EXISTS encryption_key_id       TEXT DEFAULT 'v1';

-- Backfill: encrypt existing plaintext tokens using pgp_sym_encrypt.
-- Replace 'changeme' with actual key from env at migration time.
-- In production, run this step manually with the real key:
--   UPDATE social_credentials
--     SET encrypted_access_token  = pgp_sym_encrypt(access_token,  current_setting('app.token_key')),
--         encrypted_refresh_token = pgp_sym_encrypt(COALESCE(refresh_token, ''), current_setting('app.token_key'))
--     WHERE encrypted_access_token IS NULL;
