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
