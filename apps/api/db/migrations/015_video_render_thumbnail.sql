-- Phase 7: add thumbnail_url to video_render_jobs for preview generation
ALTER TABLE video_render_jobs
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
