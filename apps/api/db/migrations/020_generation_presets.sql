-- Migration 020: generation presets — named reusable generation templates
-- Users save a creative brief as a named preset (e.g. "Holiday Promo", "Product Launch")
-- and reload it for future generations to maintain consistent branding + content direction.

CREATE TABLE IF NOT EXISTS generation_presets (
  id          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  tenant_id   TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  description TEXT,
  -- generation type: 'video' | 'image' | 'copy'
  gen_type    TEXT        NOT NULL DEFAULT 'video',
  platform    TEXT,
  -- stored brief fields
  headline    TEXT,
  body        TEXT,
  cta         TEXT,
  mood        TEXT,
  imagery_direction TEXT,
  custom_tagline    TEXT,
  -- voice directive overrides
  tone_shift  TEXT,
  -- voiceover enabled (video only)
  voiceover   BOOLEAN     NOT NULL DEFAULT false,
  -- quality: 'standard' | 'hd' (image only)
  quality     TEXT,
  use_count   INTEGER     NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS generation_presets_tenant_updated
  ON generation_presets (tenant_id, updated_at DESC);
