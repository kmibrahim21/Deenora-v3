-- Run this in your Supabase SQL Editor to support Subject sorting
ALTER TABLE exam_subjects ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE befaq_subjects ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
