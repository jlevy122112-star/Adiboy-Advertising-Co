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
