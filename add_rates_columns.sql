-- Add sms_rate and voice_rate columns to institutions table
ALTER TABLE public.institutions 
ADD COLUMN IF NOT EXISTS sms_rate NUMERIC DEFAULT 0.50,
ADD COLUMN IF NOT EXISTS voice_rate NUMERIC DEFAULT 0.50;

-- Reload schema cache
NOTIFY pgrst, 'reload config';
