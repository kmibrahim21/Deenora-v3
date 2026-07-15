-- Migration: Add is_published to befaq_exams table
ALTER TABLE befaq_exams ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
