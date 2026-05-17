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
