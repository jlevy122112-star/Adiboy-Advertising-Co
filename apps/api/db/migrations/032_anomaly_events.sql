CREATE TABLE IF NOT EXISTS anomaly_events (
  id               TEXT        PRIMARY KEY,
  workspace_id     TEXT        NOT NULL,
  type             TEXT        NOT NULL,
  severity         TEXT        NOT NULL,
  description      TEXT        NOT NULL,
  metadata_json    JSONB       NOT NULL DEFAULT '{}',
  acknowledged_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS anomaly_events_workspace ON anomaly_events(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS anomaly_events_unacked ON anomaly_events(workspace_id, acknowledged_at) WHERE acknowledged_at IS NULL;
