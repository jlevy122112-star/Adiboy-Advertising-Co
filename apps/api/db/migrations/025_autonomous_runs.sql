CREATE TABLE IF NOT EXISTS autonomous_runs (
  id              TEXT        PRIMARY KEY,
  tenant_id       TEXT        NOT NULL,
  workspace_id    TEXT        NOT NULL,
  state           TEXT        NOT NULL DEFAULT 'requested',
  networks        TEXT[]      NOT NULL DEFAULT '{}',
  scope           TEXT        NOT NULL DEFAULT 'single_post',
  run_json        JSONB       NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS autonomous_runs_tenant     ON autonomous_runs (tenant_id);
CREATE INDEX IF NOT EXISTS autonomous_runs_tenant_state ON autonomous_runs (tenant_id, state);
CREATE INDEX IF NOT EXISTS autonomous_runs_updated    ON autonomous_runs (updated_at DESC);

CREATE TABLE IF NOT EXISTS autonomous_run_events (
  id          TEXT        PRIMARY KEY,
  run_id      TEXT        NOT NULL REFERENCES autonomous_runs(id) ON DELETE CASCADE,
  tenant_id   TEXT        NOT NULL,
  event_json  JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS autonomous_run_events_run ON autonomous_run_events (run_id, created_at);
