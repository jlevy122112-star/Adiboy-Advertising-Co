CREATE TABLE IF NOT EXISTS content_safety_scans (
  id               TEXT        PRIMARY KEY,
  workspace_id     TEXT        NOT NULL,
  entity_type      TEXT,
  entity_id        TEXT,
  scanned_text     TEXT        NOT NULL,
  content_types    TEXT[]      NOT NULL DEFAULT '{}',
  findings_json    JSONB       NOT NULL DEFAULT '[]',
  overall_severity TEXT        NOT NULL DEFAULT 'clean',
  passed           BOOLEAN     NOT NULL DEFAULT TRUE,
  remediated_text  TEXT,
  scanned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_safety_scans_workspace ON content_safety_scans(workspace_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS content_safety_scans_entity ON content_safety_scans(entity_type, entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS content_safety_scans_severity ON content_safety_scans(workspace_id, overall_severity) WHERE overall_severity != 'clean';
