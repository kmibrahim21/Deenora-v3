-- Migration to add global update fields to system_settings
-- Run this in your Supabase SQL Editor

-- 1. Add columns if they don't exist
ALTER TABLE system_settings 
ADD COLUMN IF NOT EXISTS global_update_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS global_update_message TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS global_update_version INTEGER DEFAULT 0;

-- 2. Ensure the specific record exists
INSERT INTO system_settings (id) 
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- 3. Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 4. Policy: Anyone can view the system settings (essential for the popup to show for users)
DROP POLICY IF EXISTS "System settings are viewable by everyone" ON system_settings;
CREATE POLICY "System settings are viewable by everyone" 
ON system_settings FOR SELECT 
USING (id = '00000000-0000-0000-0000-000000000001');

-- 5. Policy: Authenticated users (Admins) can update system settings
DROP POLICY IF EXISTS "Admins can update system settings" ON system_settings;
CREATE POLICY "Admins can update system settings" 
ON system_settings FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

-- 6. Ensure full replica identity for realtime (sends full 'new' record)
ALTER TABLE system_settings REPLICA IDENTITY FULL;

-- 7. Attempt to add to realtime publication (ignore if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'system_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE system_settings;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;
