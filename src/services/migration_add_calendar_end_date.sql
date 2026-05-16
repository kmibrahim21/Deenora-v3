-- Add end_date to calendar_events
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS end_date DATE;
