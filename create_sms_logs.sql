-- Create sms_logs table
CREATE TABLE IF NOT EXISTS public.sms_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
    recipient TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'sent',
    parts INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can view their own sms_logs" ON public.sms_logs;
CREATE POLICY "Users can view their own sms_logs" ON public.sms_logs FOR SELECT USING (institution_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own sms_logs" ON public.sms_logs;
CREATE POLICY "Users can insert their own sms_logs" ON public.sms_logs FOR INSERT WITH CHECK (institution_id = auth.uid());

-- Reload schema cache
NOTIFY pgrst, 'reload config';
