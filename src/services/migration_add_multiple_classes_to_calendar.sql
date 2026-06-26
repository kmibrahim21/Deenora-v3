-- Add class_ids column to calendar_events to support multiple class selection
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='calendar_events' AND column_name='class_ids') THEN
        ALTER TABLE calendar_events ADD COLUMN class_ids UUID[] DEFAULT '{}';
    END IF;
END $$;
