CREATE TABLE IF NOT EXISTS team_notifications (
  id            TEXT        PRIMARY KEY,
  user_id       TEXT        NOT NULL,
  workspace_id  TEXT        NOT NULL,
  type          TEXT        NOT NULL,
  entity_type   TEXT,
  entity_id     TEXT,
  title         TEXT        NOT NULL,
  body          TEXT        NOT NULL DEFAULT '',
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS change_history (
  id            TEXT        PRIMARY KEY,
  workspace_id  TEXT        NOT NULL,
  entity_type   TEXT        NOT NULL,
  entity_id     TEXT        NOT NULL,
  actor_id      TEXT        NOT NULL,
  actor_name    TEXT        NOT NULL DEFAULT '',
  action        TEXT        NOT NULL,
  field         TEXT,
  old_value     TEXT,
  new_value     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS team_notifications_user ON team_notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS team_notifications_workspace ON team_notifications(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS change_history_entity ON change_history(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS change_history_workspace ON change_history(workspace_id, created_at DESC);
