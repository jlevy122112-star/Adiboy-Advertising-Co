-- Migration 022: analytics snapshots — per-post metrics ingested from social platforms

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id                   TEXT        NOT NULL,
  tenant_id            TEXT        NOT NULL,
  schedule_entry_id    TEXT        NOT NULL,
  network              TEXT        NOT NULL,
  period               TEXT        NOT NULL DEFAULT 'lifetime',
  external_post_id     TEXT,
  external_post_status TEXT,

  impressions          BIGINT,
  reach                BIGINT,
  engagements          BIGINT,
  clicks               BIGINT,
  saves                BIGINT,
  shares               BIGINT,
  comments             BIGINT,
  likes                BIGINT,
  follower_delta       INTEGER,
  watch_time_seconds   NUMERIC,
  view_count           BIGINT,

  fetched_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS analytics_tenant_entry
  ON analytics_snapshots (tenant_id, schedule_entry_id, fetched_at DESC);

CREATE INDEX IF NOT EXISTS analytics_tenant_network
  ON analytics_snapshots (tenant_id, network, fetched_at DESC);
