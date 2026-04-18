-- Add custom_amount column to student_fee_settings table
ALTER TABLE public.student_fee_settings ADD COLUMN IF NOT EXISTS custom_amount DECIMAL(10,2) DEFAULT NULL;
