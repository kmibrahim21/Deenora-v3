-- Migration for High School result columns and Optional subjects
-- Run this in your Supabase SQL Editor

-- 1. Add columns to exam_subjects
ALTER TABLE exam_subjects 
ADD COLUMN IF NOT EXISTS is_optional BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cq_full_marks NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS mcq_full_marks NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS practical_full_marks NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS pair_with_id UUID REFERENCES exam_subjects(id);

-- 2. Add columns to exam_marks
ALTER TABLE exam_marks 
ADD COLUMN IF NOT EXISTS cq_marks NUMERIC,
ADD COLUMN IF NOT EXISTS mcq_marks NUMERIC,
ADD COLUMN IF NOT EXISTS practical_marks NUMERIC;
