CREATE TABLE IF NOT EXISTS schedule_recommendations (
  id                TEXT        PRIMARY KEY,
  tenant_id         TEXT        NOT NULL,
  schedule_entry_id TEXT,
  network           TEXT        NOT NULL,
  content_type      TEXT,
  audience_timezone TEXT,
  top_slots_json    JSONB       NOT NULL DEFAULT '[]',
  applied_slot_json JSONB,
  applied_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS schedule_rec_tenant       ON schedule_recommendations (tenant_id);
CREATE INDEX IF NOT EXISTS schedule_rec_tenant_entry ON schedule_recommendations (tenant_id, schedule_entry_id);
CREATE INDEX IF NOT EXISTS schedule_rec_tenant_net   ON schedule_recommendations (tenant_id, network);
