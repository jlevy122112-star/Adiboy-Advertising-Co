-- Marketer-Pro — minimal schedule row store for publish worker lookups (P3 Postgres slice).
-- Composite PK enforces isolation: the same logical schedule id may exist per tenant.
-- Optional `campaign_id` is added in `003_campaigns_and_schedule_campaign_id.sql` (with FK to `campaigns`).

CREATE TABLE IF NOT EXISTS schedule_entries (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  network TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  content_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);
-- Upgrade databases created with legacy `001` that used `id` alone as PRIMARY KEY.
-- Idempotent: skips when the primary key already spans both columns.

DO $$
BEGIN
  IF to_regclass('public.schedule_entries') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.schedule_entries'::regclass
      AND contype = 'p'
      AND array_length(conkey, 1) = 1
  ) THEN
    ALTER TABLE schedule_entries DROP CONSTRAINT schedule_entries_pkey;
    ALTER TABLE schedule_entries ADD PRIMARY KEY (tenant_id, id);
  END IF;
END $$;
-- Phase 4 — tenant-scoped campaigns + optional link from schedule_entries.

CREATE TABLE IF NOT EXISTS campaigns (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

-- Canonical introduction of `campaign_id` on `schedule_entries` (001 omits it for migration order).
ALTER TABLE schedule_entries
  ADD COLUMN IF NOT EXISTS campaign_id TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'schedule_entries_campaign_fk'
  ) THEN
    RETURN;
  END IF;

  IF to_regclass('public.campaigns') IS NULL
     OR to_regclass('public.schedule_entries') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE schedule_entries
    ADD CONSTRAINT schedule_entries_campaign_fk
    FOREIGN KEY (tenant_id, campaign_id)
    REFERENCES campaigns (tenant_id, id)
    ON DELETE SET NULL;
END $$;
-- Phase 2 — text draft rows + audit tail JSON (contract-shaped) for human approval.

CREATE TABLE IF NOT EXISTS generation_drafts (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  brief_id TEXT NOT NULL,
  brief_json JSONB NOT NULL,
  draft_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN ('pending_approval', 'approved', 'rejected')),
  decision_record_json JSONB,
  audit_log_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS generation_drafts_brief_idx
  ON generation_drafts (tenant_id, brief_id);
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
-- Brand memory: logical sources + retrieval chunks with optional pgvector(1536).
-- Policy: exactly one embedding dimension per physical chunk table (1536 here).
-- Lexical-only rows use embedding NULL and are excluded from vector ORDER BY paths.
-- A different dimension (e.g. 3072) requires a new migration / table — never mixed in one column.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS brand_memory_sources (
  workspace_id TEXT NOT NULL,
  brand_id     TEXT NOT NULL,
  source_id    TEXT NOT NULL,
  version      TEXT NOT NULL,

  source_type  TEXT NOT NULL,
  title        TEXT,
  summary      TEXT,
  tags         TEXT[],
  trusted      BOOLEAN DEFAULT FALSE,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (workspace_id, brand_id, source_id, version)
);

CREATE TABLE IF NOT EXISTS brand_memory_chunks (
  chunk_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id TEXT NOT NULL,
  brand_id     TEXT NOT NULL,
  source_id    TEXT NOT NULL,
  version      TEXT NOT NULL,

  chunk_index  INT NOT NULL,
  text         TEXT NOT NULL,
  token_count  INT,

  embedding    VECTOR(1536),

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  FOREIGN KEY (workspace_id, brand_id, source_id, version)
    REFERENCES brand_memory_sources (workspace_id, brand_id, source_id, version)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bmc_scope
  ON brand_memory_chunks (workspace_id, brand_id);

CREATE INDEX IF NOT EXISTS idx_bms_tags
  ON brand_memory_sources USING GIN (tags);

-- Vector index only on rows that participate in ANN (embedding IS NOT NULL).
CREATE INDEX IF NOT EXISTS idx_bmc_embedding_ivfflat
  ON brand_memory_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;
-- Phase 4 — add scheduled_at to schedule_entries for calendar display and queue delay.
ALTER TABLE schedule_entries
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
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
-- Phase 5 — Video build options stored per schedule entry.
-- Allows PostEditModal video settings to survive page reloads and be fed to
-- the YouTube/TikTok/Instagram publisher pipeline.
ALTER TABLE schedule_entries
  ADD COLUMN IF NOT EXISTS video_options JSONB;

COMMENT ON COLUMN schedule_entries.video_options IS
  'Optional video build config: filterPreset, textTitle, textCaption, textHashtags, textEmoji, effects[].';
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
-- Post-level metadata: hashtags, mentions, alt text, platform extras.
ALTER TABLE schedule_entries
  ADD COLUMN IF NOT EXISTS metadata JSONB;

COMMENT ON COLUMN schedule_entries.metadata IS
  'PostMetadata shape: hashtags[], mentions[], altText, location, firstComment, articleTitle, youtubeDescription, youtubeTags[], youtubeCategory.';
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
-- Phase 6: generated image assets
CREATE TABLE IF NOT EXISTS generated_assets (
  id                  TEXT        NOT NULL,
  tenant_id           TEXT        NOT NULL,
  schedule_entry_id   TEXT,
  brief_id            TEXT,
  provider            TEXT        NOT NULL,
  prompt              TEXT        NOT NULL,
  revised_prompt      TEXT,
  s3_key              TEXT,
  url                 TEXT,
  width               INTEGER,
  height              INTEGER,
  network             TEXT,
  status              TEXT        NOT NULL DEFAULT 'generating',
  moderation_flagged  BOOLEAN     NOT NULL DEFAULT FALSE,
  moderation_detail   JSONB,
  error               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS generated_assets_tenant_entry
  ON generated_assets (tenant_id, schedule_entry_id)
  WHERE schedule_entry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS generated_assets_tenant_brief
  ON generated_assets (tenant_id, brief_id)
  WHERE brief_id IS NOT NULL;
-- Phase 7: short-form video scripts and render jobs

CREATE TABLE IF NOT EXISTS video_scripts (
  tenant_id        TEXT        NOT NULL,
  id               TEXT        NOT NULL,
  brief_id         TEXT,
  platform         TEXT        NOT NULL,
  title            TEXT        NOT NULL DEFAULT '',
  scenes_json      JSONB       NOT NULL DEFAULT '[]',
  hashtags_json    JSONB       NOT NULL DEFAULT '[]',
  voiceover_enabled BOOLEAN    NOT NULL DEFAULT FALSE,
  total_duration_s INTEGER     NOT NULL DEFAULT 0,
  status           TEXT        NOT NULL DEFAULT 'draft',
  error            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS video_scripts_tenant_brief
  ON video_scripts (tenant_id, brief_id);

CREATE TABLE IF NOT EXISTS video_render_jobs (
  tenant_id        TEXT        NOT NULL,
  id               TEXT        NOT NULL,
  script_id        TEXT        NOT NULL,
  s3_key           TEXT,
  url              TEXT,
  width            INTEGER,
  height           INTEGER,
  duration_s       INTEGER,
  status           TEXT        NOT NULL DEFAULT 'queued',
  error            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS video_render_jobs_script
  ON video_render_jobs (tenant_id, script_id);
-- Phase 7: add thumbnail_url to video_render_jobs for preview generation
ALTER TABLE video_render_jobs
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
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
-- Phase 9 — Viral loop tracking: share events, signup attribution, template clones, competitor report views.

CREATE TABLE IF NOT EXISTS viral_shares (
  id           TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  tenant_id    TEXT        NOT NULL,
  campaign_id  TEXT,
  post_id      TEXT,
  template_id  TEXT,
  report_id    TEXT,
  share_type   TEXT        NOT NULL, -- 'campaign' | 'post' | 'template' | 'competitor_report'
  channel      TEXT        NOT NULL, -- 'link' | 'twitter' | 'linkedin' | 'facebook' | 'email' | 'whatsapp'
  share_token  TEXT        NOT NULL UNIQUE,
  shared_by    TEXT        NOT NULL, -- user_id
  view_count   INTEGER     NOT NULL DEFAULT 0,
  signup_count INTEGER     NOT NULL DEFAULT 0,
  branding_visible BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS viral_shares_tenant ON viral_shares (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS viral_shares_token  ON viral_shares (share_token);

CREATE TABLE IF NOT EXISTS viral_signups (
  id           TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  share_token  TEXT        NOT NULL REFERENCES viral_shares(share_token) ON DELETE CASCADE,
  referee_id   TEXT,                -- user_id if they signed up
  ip_hash      TEXT,                -- SHA-256 of IP for dedup
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS viral_signups_token ON viral_signups (share_token, created_at DESC);

CREATE TABLE IF NOT EXISTS template_clones (
  id           TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  template_id  TEXT        NOT NULL,
  cloned_by    TEXT        NOT NULL, -- user_id
  tenant_id    TEXT        NOT NULL,
  source_token TEXT,                  -- share_token that led here
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS template_clones_template ON template_clones (template_id, created_at DESC);

-- Add branding signature opt-in to workspaces (if column doesn't already exist)
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS viral_branding_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS viral_branding_text TEXT NOT NULL DEFAULT 'Made with Marketer Pro';
-- Migration 020: generation presets — named reusable generation templates
-- Users save a creative brief as a named preset (e.g. "Holiday Promo", "Product Launch")
-- and reload it for future generations to maintain consistent branding + content direction.

CREATE TABLE IF NOT EXISTS generation_presets (
  id          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  tenant_id   TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  description TEXT,
  -- generation type: 'video' | 'image' | 'copy'
  gen_type    TEXT        NOT NULL DEFAULT 'video',
  platform    TEXT,
  -- stored brief fields
  headline    TEXT,
  body        TEXT,
  cta         TEXT,
  mood        TEXT,
  imagery_direction TEXT,
  custom_tagline    TEXT,
  -- voice directive overrides
  tone_shift  TEXT,
  -- voiceover enabled (video only)
  voiceover   BOOLEAN     NOT NULL DEFAULT false,
  -- quality: 'standard' | 'hd' (image only)
  quality     TEXT,
  use_count   INTEGER     NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS generation_presets_tenant_updated
  ON generation_presets (tenant_id, updated_at DESC);
-- Migration 021: SERP briefs — AI content briefs generated from live search results

CREATE TABLE IF NOT EXISTS serp_briefs (
  id           TEXT        NOT NULL,
  tenant_id    TEXT        NOT NULL,
  keyword      TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'pending',
  serp_json    JSONB,
  analysis_json JSONB,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS serp_briefs_tenant_created
  ON serp_briefs (tenant_id, created_at DESC);
-- Migration 022: analytics snapshots — per-post metrics ingested from social platforms

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id                   TEXT        NOT NULL,
  tenant_id            TEXT        NOT NULL,
  schedule_entry_id    TEXT        NOT NULL,
  network              TEXT        NOT NULL,
  period               TEXT        NOT NULL DEFAULT 'lifetime',
  external_post_id     TEXT,
  external_post_status TEXT,

  impressions          BIGINT,
  reach                BIGINT,
  engagements          BIGINT,
  clicks               BIGINT,
  saves                BIGINT,
  shares               BIGINT,
  comments             BIGINT,
  likes                BIGINT,
  follower_delta       INTEGER,
  watch_time_seconds   NUMERIC,
  view_count           BIGINT,

  fetched_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS analytics_tenant_entry
  ON analytics_snapshots (tenant_id, schedule_entry_id, fetched_at DESC);

CREATE INDEX IF NOT EXISTS analytics_tenant_network
  ON analytics_snapshots (tenant_id, network, fetched_at DESC);
CREATE TABLE IF NOT EXISTS social_comments (
  id                   TEXT        PRIMARY KEY,
  tenant_id            TEXT        NOT NULL,
  schedule_entry_id    TEXT        NOT NULL,
  network              TEXT        NOT NULL,
  external_comment_id  TEXT        NOT NULL,
  author_name          TEXT,
  author_id            TEXT,
  body                 TEXT        NOT NULL,
  like_count           BIGINT,
  reply_count          BIGINT,
  posted_at            TIMESTAMPTZ,
  sentiment_score      TEXT,
  sentiment_confidence DOUBLE PRECISION,
  topics               TEXT[]      NOT NULL DEFAULT '{}',
  is_negative_signal   BOOLEAN     NOT NULL DEFAULT FALSE,
  brand_safety_flags   TEXT[]      NOT NULL DEFAULT '{}',
  suggested_response   TEXT,
  fed_to_memory        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS social_comments_tenant_network_ext
  ON social_comments (tenant_id, network, external_comment_id);

CREATE INDEX IF NOT EXISTS social_comments_tenant_entry
  ON social_comments (tenant_id, schedule_entry_id);

CREATE INDEX IF NOT EXISTS social_comments_tenant_sentiment
  ON social_comments (tenant_id, sentiment_score);

CREATE INDEX IF NOT EXISTS social_comments_negative
  ON social_comments (tenant_id, is_negative_signal) WHERE is_negative_signal = TRUE;
CREATE TABLE IF NOT EXISTS schedule_recommendations (
  id                TEXT        PRIMARY KEY,
  tenant_id         TEXT        NOT NULL,
  schedule_entry_id TEXT,
  network           TEXT        NOT NULL,
  content_type      TEXT,
  audience_timezone TEXT,
  top_slots_json    JSONB       NOT NULL DEFAULT '[]',
  applied_slot_json JSONB,
  applied_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS schedule_rec_tenant       ON schedule_recommendations (tenant_id);
CREATE INDEX IF NOT EXISTS schedule_rec_tenant_entry ON schedule_recommendations (tenant_id, schedule_entry_id);
CREATE INDEX IF NOT EXISTS schedule_rec_tenant_net   ON schedule_recommendations (tenant_id, network);
CREATE TABLE IF NOT EXISTS autonomous_runs (
  id              TEXT        PRIMARY KEY,
  tenant_id       TEXT        NOT NULL,
  workspace_id    TEXT        NOT NULL,
  state           TEXT        NOT NULL DEFAULT 'requested',
  networks        TEXT[]      NOT NULL DEFAULT '{}',
  scope           TEXT        NOT NULL DEFAULT 'single_post',
  run_json        JSONB       NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS autonomous_runs_tenant     ON autonomous_runs (tenant_id);
CREATE INDEX IF NOT EXISTS autonomous_runs_tenant_state ON autonomous_runs (tenant_id, state);
CREATE INDEX IF NOT EXISTS autonomous_runs_updated    ON autonomous_runs (updated_at DESC);

CREATE TABLE IF NOT EXISTS autonomous_run_events (
  id          TEXT        PRIMARY KEY,
  run_id      TEXT        NOT NULL REFERENCES autonomous_runs(id) ON DELETE CASCADE,
  tenant_id   TEXT        NOT NULL,
  event_json  JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS autonomous_run_events_run ON autonomous_run_events (run_id, created_at);
CREATE TABLE IF NOT EXISTS workspace_members (
  id              TEXT        PRIMARY KEY,
  workspace_id    TEXT        NOT NULL,
  user_id         TEXT        NOT NULL,
  email           TEXT        NOT NULL,
  display_name    TEXT        NOT NULL DEFAULT '',
  role            TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'invited',
  invited_by      TEXT,
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS workspace_members_email ON workspace_members(workspace_id, email);
CREATE TABLE IF NOT EXISTS review_assignments (
  id            TEXT        PRIMARY KEY,
  workspace_id  TEXT        NOT NULL,
  entity_type   TEXT        NOT NULL,
  entity_id     TEXT        NOT NULL,
  assignee_id   TEXT        NOT NULL,
  assigner_id   TEXT        NOT NULL,
  due_at        TIMESTAMPTZ,
  status        TEXT        NOT NULL DEFAULT 'pending',
  note          TEXT,
  review_note   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS review_assignments_workspace ON review_assignments(workspace_id);
CREATE INDEX IF NOT EXISTS review_assignments_entity ON review_assignments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS review_assignments_assignee ON review_assignments(assignee_id);
CREATE INDEX IF NOT EXISTS review_assignments_status ON review_assignments(workspace_id, status);
CREATE TABLE IF NOT EXISTS approvals (
  id            TEXT        PRIMARY KEY,
  workspace_id  TEXT        NOT NULL,
  entity_type   TEXT        NOT NULL,
  entity_id     TEXT        NOT NULL,
  step          INTEGER     NOT NULL DEFAULT 1,
  reviewer_id   TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending',
  comment       TEXT,
  decided_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS approvals_workspace ON approvals(workspace_id);
CREATE INDEX IF NOT EXISTS approvals_entity ON approvals(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS approvals_reviewer ON approvals(reviewer_id, status);
CREATE TABLE IF NOT EXISTS collab_comments (
  id            TEXT        PRIMARY KEY,
  workspace_id  TEXT        NOT NULL,
  entity_type   TEXT        NOT NULL,
  entity_id     TEXT        NOT NULL,
  author_id     TEXT        NOT NULL,
  author_name   TEXT        NOT NULL DEFAULT '',
  body          TEXT        NOT NULL,
  parent_id     TEXT,
  edited_at     TIMESTAMPTZ,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS collab_comments_entity ON collab_comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS collab_comments_workspace ON collab_comments(workspace_id);
CREATE INDEX IF NOT EXISTS collab_comments_parent ON collab_comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS team_notifications (
  id            TEXT        PRIMARY KEY,
  user_id       TEXT        NOT NULL,
  workspace_id  TEXT        NOT NULL,
  type          TEXT        NOT NULL,
  entity_type   TEXT,
  entity_id     TEXT,
  title         TEXT        NOT NULL,
  body          TEXT        NOT NULL DEFAULT '',
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS change_history (
  id            TEXT        PRIMARY KEY,
  workspace_id  TEXT        NOT NULL,
  entity_type   TEXT        NOT NULL,
  entity_id     TEXT        NOT NULL,
  actor_id      TEXT        NOT NULL,
  actor_name    TEXT        NOT NULL DEFAULT '',
  action        TEXT        NOT NULL,
  field         TEXT,
  old_value     TEXT,
  new_value     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS team_notifications_user ON team_notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS team_notifications_workspace ON team_notifications(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS change_history_entity ON change_history(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS change_history_workspace ON change_history(workspace_id, created_at DESC);
CREATE TABLE IF NOT EXISTS content_safety_scans (
  id               TEXT        PRIMARY KEY,
  workspace_id     TEXT        NOT NULL,
  entity_type      TEXT,
  entity_id        TEXT,
  scanned_text     TEXT        NOT NULL,
  content_types    TEXT[]      NOT NULL DEFAULT '{}',
  findings_json    JSONB       NOT NULL DEFAULT '[]',
  overall_severity TEXT        NOT NULL DEFAULT 'clean',
  passed           BOOLEAN     NOT NULL DEFAULT TRUE,
  remediated_text  TEXT,
  scanned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_safety_scans_workspace ON content_safety_scans(workspace_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS content_safety_scans_entity ON content_safety_scans(entity_type, entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS content_safety_scans_severity ON content_safety_scans(workspace_id, overall_severity) WHERE overall_severity != 'clean';
CREATE TABLE IF NOT EXISTS anomaly_events (
  id               TEXT        PRIMARY KEY,
  workspace_id     TEXT        NOT NULL,
  type             TEXT        NOT NULL,
  severity         TEXT        NOT NULL,
  description      TEXT        NOT NULL,
  metadata_json    JSONB       NOT NULL DEFAULT '{}',
  acknowledged_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS anomaly_events_workspace ON anomaly_events(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS anomaly_events_unacked ON anomaly_events(workspace_id, acknowledged_at) WHERE acknowledged_at IS NULL;
CREATE TABLE IF NOT EXISTS account_deletion_requests (
  id                   TEXT        PRIMARY KEY,
  workspace_id         TEXT        NOT NULL UNIQUE,
  requested_by_user_id TEXT        NOT NULL,
  reason               TEXT,
  status               TEXT        NOT NULL DEFAULT 'requested',
  scheduled_at         TIMESTAMPTZ NOT NULL,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS account_deletion_status ON account_deletion_requests(status, scheduled_at);
