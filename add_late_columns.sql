-- Migration: Add late tracking columns to attendance
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS arrival_time TIME;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS late_minutes INTEGER;
