-- Add section column to students table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='section') THEN
        ALTER TABLE students ADD COLUMN section TEXT;
    END IF;
END $$;
