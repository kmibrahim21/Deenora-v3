-- Add is_active column to students table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='is_active') THEN
        ALTER TABLE students ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;
