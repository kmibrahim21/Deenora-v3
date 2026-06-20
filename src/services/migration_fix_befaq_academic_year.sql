-- Migration: Add academic_year_id to befaq_exams
-- This script adds the missing academic_year_id column to the befaq_exams table

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'befaq_exams' AND column_name = 'academic_year_id') THEN
        ALTER TABLE befaq_exams ADD COLUMN academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create index if not exists
CREATE INDEX IF NOT EXISTS idx_befaq_exams_academic_year_id ON befaq_exams(academic_year_id);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
