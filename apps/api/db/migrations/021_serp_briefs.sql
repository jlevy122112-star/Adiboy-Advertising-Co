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
