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
