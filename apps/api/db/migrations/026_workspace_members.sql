CREATE TABLE IF NOT EXISTS workspace_members (
  id              TEXT        PRIMARY KEY,
  workspace_id    TEXT        NOT NULL,
  user_id         TEXT        NOT NULL,
  email           TEXT        NOT NULL,
  display_name    TEXT        NOT NULL DEFAULT '',
  role            TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'invited',
  invited_by      TEXT,
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS workspace_members_email ON workspace_members(workspace_id, email);
