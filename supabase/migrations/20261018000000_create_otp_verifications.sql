CREATE TABLE IF NOT EXISTS public.otp_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL, -- Email or Phone
    otp TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_otp_identifier ON public.otp_verifications(identifier);

-- RLS (Restrict access to service role or specific logic)
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- Only service role can do anything here for security
CREATE POLICY "Service role only" ON public.otp_verifications
    USING (auth.jwt() ->> 'role' = 'service_role');
