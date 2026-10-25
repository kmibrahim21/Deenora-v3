-- Migration: Ensure is_active exists or status is compatible on voice_templates
-- Run this in Supabase SQL Editor if you want to support is_active on voice_templates in the future:
ALTER TABLE voice_templates ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
