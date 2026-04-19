-- Add target_class_name to track which class was selected
ALTER TABLE voice_broadcasts ADD COLUMN IF NOT EXISTS target_class_name TEXT;

-- Add retries array to store multiple retry campaign IDs
ALTER TABLE voice_broadcasts ADD COLUMN IF NOT EXISTS retries JSONB DEFAULT '[]'::jsonb;
