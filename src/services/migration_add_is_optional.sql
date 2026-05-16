-- Add is_optional column to exam_subjects
ALTER TABLE exam_subjects ADD COLUMN IF NOT EXISTS is_optional BOOLEAN DEFAULT FALSE;

-- If you have a befaq_subjects or other similar table, you might want it there too, though currently only exam_subjects uses it
