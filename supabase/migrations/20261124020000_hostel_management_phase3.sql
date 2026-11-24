-- Phase 3 (Final Phase): Gate Pass, Night Roll Call & Parent Portal Hostel Integration
-- Extends hostel_leaves and hostel_meal_logs idempotently while maintaining strict tenant isolation

ALTER TABLE IF EXISTS hostel_leaves
    ADD COLUMN IF NOT EXISTS guardian_relation TEXT,
    ADD COLUMN IF NOT EXISTS leave_from DATE,
    ADD COLUMN IF NOT EXISTS expected_return DATE,
    ADD COLUMN IF NOT EXISTS actual_return TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS approved_by TEXT;

-- Keep start_date / end_date nullable for flexibility when inserting via leave_from / expected_return
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hostel_leaves' AND column_name = 'start_date'
    ) THEN
        ALTER TABLE hostel_leaves ALTER COLUMN start_date DROP NOT NULL;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'hostel_leaves' AND column_name = 'end_date'
    ) THEN
        ALTER TABLE hostel_leaves ALTER COLUMN end_date DROP NOT NULL;
    END IF;
END $$;

-- Backfill leave_from / expected_return from start_date / end_date if existing rows exist
UPDATE hostel_leaves
SET leave_from = COALESCE(leave_from, start_date),
    expected_return = COALESCE(expected_return, end_date)
WHERE leave_from IS NULL OR expected_return IS NULL;

CREATE INDEX IF NOT EXISTS hostel_leaves_inst_status_idx
    ON hostel_leaves(institution_id, status, created_at DESC);

-- Add Night Roll Call column to hostel_meal_logs
ALTER TABLE IF EXISTS hostel_meal_logs
    ADD COLUMN IF NOT EXISTS night_roll_status TEXT
    CHECK (night_roll_status IN ('present', 'leave', 'absent'));

CREATE INDEX IF NOT EXISTS hostel_meal_logs_night_roll_idx
    ON hostel_meal_logs(institution_id, log_date, night_roll_status);
