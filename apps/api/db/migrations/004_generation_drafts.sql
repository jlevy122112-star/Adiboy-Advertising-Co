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
