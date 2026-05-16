-- Phase 8: SERP-based AI content briefs

CREATE TABLE IF NOT EXISTS serp_briefs (
  tenant_id             TEXT        NOT NULL,
  id                    TEXT        NOT NULL,
  keyword               TEXT        NOT NULL,
  location              TEXT,
  intent                TEXT        NOT NULL DEFAULT 'informational',
  top_results_json      JSONB       NOT NULL DEFAULT '[]',
  competitor_summary    TEXT        NOT NULL DEFAULT '',
  content_gaps_json     JSONB       NOT NULL DEFAULT '[]',
  suggested_angle       TEXT        NOT NULL DEFAULT '',
  suggested_headline    TEXT        NOT NULL DEFAULT '',
  suggested_outline_json JSONB      NOT NULL DEFAULT '[]',
  secondary_keywords_json JSONB     NOT NULL DEFAULT '[]',
  seo_score             INTEGER     NOT NULL DEFAULT 0,
  status                TEXT        NOT NULL DEFAULT 'pending',
  error                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS serp_briefs_tenant_keyword
  ON serp_briefs (tenant_id, keyword);
