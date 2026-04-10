-- Add blood_group column to students table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='blood_group') THEN
        ALTER TABLE students ADD COLUMN blood_group TEXT;
    END IF;
END $$;
