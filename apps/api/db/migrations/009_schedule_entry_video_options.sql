-- Phase 5 — Video build options stored per schedule entry.
-- Allows PostEditModal video settings to survive page reloads and be fed to
-- the YouTube/TikTok/Instagram publisher pipeline.
ALTER TABLE schedule_entries
  ADD COLUMN IF NOT EXISTS video_options JSONB;

COMMENT ON COLUMN schedule_entries.video_options IS
  'Optional video build config: filterPreset, textTitle, textCaption, textHashtags, textEmoji, effects[].';
