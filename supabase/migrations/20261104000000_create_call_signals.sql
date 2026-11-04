-- Migration: create call_signals table for multi-instance backend signaling relay
CREATE TABLE IF NOT EXISTS public.call_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id TEXT NOT NULL,
    event TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    consumed BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_call_signals_call_id_consumed ON public.call_signals(call_id, consumed);
CREATE INDEX IF NOT EXISTS idx_call_signals_created_at ON public.call_signals(created_at);

ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;

-- Allow anon and service_role to read and write (for serverless api & web client fallback)
CREATE POLICY "Allow public read-write for call_signals" ON public.call_signals
    FOR ALL
    USING (true)
    WITH CHECK (true);
