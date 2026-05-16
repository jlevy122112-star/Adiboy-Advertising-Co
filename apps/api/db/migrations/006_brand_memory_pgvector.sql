-- Brand memory: logical sources + retrieval chunks with optional pgvector(1536).
-- Policy: exactly one embedding dimension per physical chunk table (1536 here).
-- Lexical-only rows use embedding NULL and are excluded from vector ORDER BY paths.
-- A different dimension (e.g. 3072) requires a new migration / table — never mixed in one column.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS brand_memory_sources (
  workspace_id TEXT NOT NULL,
  brand_id     TEXT NOT NULL,
  source_id    TEXT NOT NULL,
  version      TEXT NOT NULL,

  source_type  TEXT NOT NULL,
  title        TEXT,
  summary      TEXT,
  tags         TEXT[],
  trusted      BOOLEAN DEFAULT FALSE,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (workspace_id, brand_id, source_id, version)
);

CREATE TABLE IF NOT EXISTS brand_memory_chunks (
  chunk_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  workspace_id TEXT NOT NULL,
  brand_id     TEXT NOT NULL,
  source_id    TEXT NOT NULL,
  version      TEXT NOT NULL,

  chunk_index  INT NOT NULL,
  text         TEXT NOT NULL,
  token_count  INT,

  embedding    VECTOR(1536),

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  FOREIGN KEY (workspace_id, brand_id, source_id, version)
    REFERENCES brand_memory_sources (workspace_id, brand_id, source_id, version)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bmc_scope
  ON brand_memory_chunks (workspace_id, brand_id);

CREATE INDEX IF NOT EXISTS idx_bms_tags
  ON brand_memory_sources USING GIN (tags);

-- Vector index only on rows that participate in ANN (embedding IS NOT NULL).
CREATE INDEX IF NOT EXISTS idx_bmc_embedding_ivfflat
  ON brand_memory_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;
