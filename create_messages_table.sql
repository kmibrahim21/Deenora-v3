-- Run this SQL in your Supabase SQL Editor:
-- It creates the messages table for your new Messages feature.

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  sender_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Turn on RLS for the table (we use Admin service role for backend logic mostly, 
-- but this is safe default for standard client-side queries)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to read messages for their institution
CREATE POLICY "Institutions can view their own messages" ON public.messages
FOR SELECT
USING (institution_id = auth.uid());

CREATE POLICY "Institutions can insert their own messages" ON public.messages
FOR INSERT
WITH CHECK (institution_id = auth.uid());

CREATE POLICY "Institutions can delete their own messages" ON public.messages
FOR DELETE
USING (institution_id = auth.uid());
