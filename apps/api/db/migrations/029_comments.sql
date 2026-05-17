CREATE TABLE IF NOT EXISTS collab_comments (
  id            TEXT        PRIMARY KEY,
  workspace_id  TEXT        NOT NULL,
  entity_type   TEXT        NOT NULL,
  entity_id     TEXT        NOT NULL,
  author_id     TEXT        NOT NULL,
  author_name   TEXT        NOT NULL DEFAULT '',
  body          TEXT        NOT NULL,
  parent_id     TEXT,
  edited_at     TIMESTAMPTZ,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS collab_comments_entity ON collab_comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS collab_comments_workspace ON collab_comments(workspace_id);
CREATE INDEX IF NOT EXISTS collab_comments_parent ON collab_comments(parent_id) WHERE parent_id IS NOT NULL;
