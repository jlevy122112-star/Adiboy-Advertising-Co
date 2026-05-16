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
