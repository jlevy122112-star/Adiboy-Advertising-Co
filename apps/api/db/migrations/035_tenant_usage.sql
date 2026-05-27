-- Per-tenant usage counters, reset each billing period
CREATE TABLE IF NOT EXISTS tenant_usage (
  tenant_id           TEXT        NOT NULL PRIMARY KEY
                                  REFERENCES workspaces(tenant_id) ON DELETE CASCADE,

  -- Current billing period window
  period_start        TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),

  -- AI generation calls (text + image combined)
  ai_generations      INTEGER     NOT NULL DEFAULT 0,
  -- Published posts (live + scheduled-and-sent)
  posts_published     INTEGER     NOT NULL DEFAULT 0,
  -- Total generated assets stored (cumulative, not reset monthly)
  assets_stored       INTEGER     NOT NULL DEFAULT 0,
  -- Estimated bytes used by stored images/assets (cumulative)
  storage_bytes       BIGINT      NOT NULL DEFAULT 0,
  -- Total API calls this period (coarse; incremented by middleware)
  api_calls           INTEGER     NOT NULL DEFAULT 0,

  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_usage_period ON tenant_usage(tenant_id, period_start);

COMMENT ON TABLE tenant_usage IS
  'Rolling per-tenant usage counters. period_start resets monthly. storage_bytes and assets_stored are cumulative.';
