CREATE TABLE IF NOT EXISTS review_assignments (
  id            TEXT        PRIMARY KEY,
  workspace_id  TEXT        NOT NULL,
  entity_type   TEXT        NOT NULL,
  entity_id     TEXT        NOT NULL,
  assignee_id   TEXT        NOT NULL,
  assigner_id   TEXT        NOT NULL,
  due_at        TIMESTAMPTZ,
  status        TEXT        NOT NULL DEFAULT 'pending',
  note          TEXT,
  review_note   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS review_assignments_workspace ON review_assignments(workspace_id);
CREATE INDEX IF NOT EXISTS review_assignments_entity ON review_assignments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS review_assignments_assignee ON review_assignments(assignee_id);
CREATE INDEX IF NOT EXISTS review_assignments_status ON review_assignments(workspace_id, status);
