-- SQL Migration Script
-- Run this script in your Supabase SQL Editor to add the missing mother_name column

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS mother_name TEXT;

-- Recommended: Ensure indexes exist for better performance
CREATE INDEX IF NOT EXISTS idx_students_institution_id ON public.students(institution_id);
CREATE INDEX IF NOT EXISTS idx_ledger_institution_id ON public.ledger(institution_id);
CREATE INDEX IF NOT EXISTS idx_fees_institution_id ON public.fees(institution_id);
