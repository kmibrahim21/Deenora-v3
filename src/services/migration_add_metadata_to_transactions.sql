-- Add metadata column to transactions table
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
