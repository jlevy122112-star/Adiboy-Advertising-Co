CREATE TABLE IF NOT EXISTS social_comments (
  id                   TEXT        PRIMARY KEY,
  tenant_id            TEXT        NOT NULL,
  schedule_entry_id    TEXT        NOT NULL,
  network              TEXT        NOT NULL,
  external_comment_id  TEXT        NOT NULL,
  author_name          TEXT,
  author_id            TEXT,
  body                 TEXT        NOT NULL,
  like_count           BIGINT,
  reply_count          BIGINT,
  posted_at            TIMESTAMPTZ,
  sentiment_score      TEXT,
  sentiment_confidence DOUBLE PRECISION,
  topics               TEXT[]      NOT NULL DEFAULT '{}',
  is_negative_signal   BOOLEAN     NOT NULL DEFAULT FALSE,
  brand_safety_flags   TEXT[]      NOT NULL DEFAULT '{}',
  suggested_response   TEXT,
  fed_to_memory        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS social_comments_tenant_network_ext
  ON social_comments (tenant_id, network, external_comment_id);

CREATE INDEX IF NOT EXISTS social_comments_tenant_entry
  ON social_comments (tenant_id, schedule_entry_id);

CREATE INDEX IF NOT EXISTS social_comments_tenant_sentiment
  ON social_comments (tenant_id, sentiment_score);

CREATE INDEX IF NOT EXISTS social_comments_negative
  ON social_comments (tenant_id, is_negative_signal) WHERE is_negative_signal = TRUE;
