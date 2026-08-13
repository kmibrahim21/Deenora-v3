-- Migration to add Automas SMS provider and Multi-Provider Routing support

-- 1. Add columns to system_settings table
ALTER TABLE public.system_settings
ADD COLUMN IF NOT EXISTS sms_provider_config JSONB DEFAULT '{
  "reve": {
    "masking_enabled": true,
    "non_masking_enabled": true
  },
  "automas": {
    "masking_enabled": false,
    "non_masking_enabled": false
  },
  "primary": {
    "masking": "reve",
    "non_masking": "reve"
  }
}'::jsonb,
ADD COLUMN IF NOT EXISTS automas_api_key TEXT,
ADD COLUMN IF NOT EXISTS automas_masking_sender_id TEXT,
ADD COLUMN IF NOT EXISTS automas_non_masking_sender_id TEXT,
ADD COLUMN IF NOT EXISTS reve_non_masking_id TEXT;

-- 2. Add columns to institutions table for institution-specific overrides
ALTER TABLE public.institutions
ADD COLUMN IF NOT EXISTS automas_api_key TEXT,
ADD COLUMN IF NOT EXISTS automas_masking_sender_id TEXT,
ADD COLUMN IF NOT EXISTS automas_non_masking_sender_id TEXT,
ADD COLUMN IF NOT EXISTS reve_non_masking_id TEXT;

-- 3. Add provider and SMS type columns to sms_logs table
ALTER TABLE public.sms_logs
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'reve',
ADD COLUMN IF NOT EXISTS sms_type TEXT DEFAULT 'masking',
ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
ADD COLUMN IF NOT EXISTS provider_status_code TEXT,
ADD COLUMN IF NOT EXISTS provider_error TEXT;

NOTIFY pgrst, 'reload config';
