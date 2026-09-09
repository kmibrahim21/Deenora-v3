CREATE TABLE IF NOT EXISTS public.pdf_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_key VARCHAR NOT NULL UNIQUE,
  data_hash VARCHAR NOT NULL,
  pdf_url VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS policies
ALTER TABLE public.pdf_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to pdf_cache"
  ON public.pdf_cache FOR SELECT
  USING (true);

CREATE POLICY "Allow service role to manage pdf_cache"
  ON public.pdf_cache FOR ALL
  USING (true)
  WITH CHECK (true);

-- Insert into storage buckets if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdf_cache', 'pdf_cache', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for pdf_cache bucket
CREATE POLICY "Allow authenticated read pdf_cache"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pdf_cache' AND auth.role() = 'authenticated');

CREATE POLICY "Allow service role to manage objects in pdf_cache"
  ON storage.objects FOR ALL
  USING (bucket_id = 'pdf_cache')
  WITH CHECK (bucket_id = 'pdf_cache');
