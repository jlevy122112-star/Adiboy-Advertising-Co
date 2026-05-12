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
