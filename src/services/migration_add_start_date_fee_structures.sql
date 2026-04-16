-- Add start_date column to fee_structures table
ALTER TABLE public.fee_structures ADD COLUMN IF NOT EXISTS start_date DATE;

-- Update existing rows to use the academic year start date or a default date if null
UPDATE public.fee_structures fs
SET start_date = ay.start_date
FROM public.academic_years ay
WHERE fs.institution_id = ay.institution_id AND ay.status = 'active' AND fs.start_date IS NULL;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload config';
