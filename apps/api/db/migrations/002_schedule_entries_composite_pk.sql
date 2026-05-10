-- Upgrade databases created with legacy `001` that used `id` alone as PRIMARY KEY.
-- Idempotent: skips when the primary key already spans both columns.

DO $$
BEGIN
  IF to_regclass('public.schedule_entries') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.schedule_entries'::regclass
      AND contype = 'p'
      AND array_length(conkey, 1) = 1
  ) THEN
    ALTER TABLE schedule_entries DROP CONSTRAINT schedule_entries_pkey;
    ALTER TABLE schedule_entries ADD PRIMARY KEY (tenant_id, id);
  END IF;
END $$;
