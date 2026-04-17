-- Add refund tracking columns to voice_broadcasts
ALTER TABLE voice_broadcasts
ADD COLUMN IF NOT EXISTS refunded_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_refunded boolean DEFAULT false;
