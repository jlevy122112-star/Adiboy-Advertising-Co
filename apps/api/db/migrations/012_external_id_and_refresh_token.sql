-- Phase 5 gap fixes:
--   1. schedule_entries.external_id — captures the platform post ID returned after publish
--   2. social_credentials.refresh_token — enables token refresh without re-auth

ALTER TABLE schedule_entries
  ADD COLUMN IF NOT EXISTS external_id TEXT;

COMMENT ON COLUMN schedule_entries.external_id IS
  'Platform-assigned post/video ID returned by the provider after a successful publish (e.g. tweet ID, FB post ID, YouTube video ID).';

ALTER TABLE social_credentials
  ADD COLUMN IF NOT EXISTS refresh_token TEXT;

COMMENT ON COLUMN social_credentials.refresh_token IS
  'OAuth 2.0 refresh token. Used to obtain a new access_token when expires_at is past. Never log or expose in API responses.';
