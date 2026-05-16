-- Phase 4 — add scheduled_at to schedule_entries for calendar display and queue delay.
ALTER TABLE schedule_entries
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
