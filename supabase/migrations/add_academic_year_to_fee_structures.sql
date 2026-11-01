-- Migration: Add academic_year_id to fee_structures table
-- Description: Ensures fee structures are isolated per academic year, so new academic years (e.g. 2027) start clean with their own fee structure.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'fee_structures' 
          AND column_name = 'academic_year_id'
    ) THEN
        ALTER TABLE fee_structures 
        ADD COLUMN academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL;
        
        CREATE INDEX IF NOT EXISTS idx_fee_structures_academic_year_id 
        ON fee_structures(academic_year_id);
    END IF;
END $$;
