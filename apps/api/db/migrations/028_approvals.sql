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
