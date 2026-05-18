-- Optimization Indexes for Madrasah SaaS (Revised)
-- These indexes target high-frequency queries and solve bottlenecks in Attendance and Students lists.
-- Run these in your Supabase SQL Editor.

-- 1. Student Table Indexes
-- Accelerates student listing, filtering by class, and institution-wide search/list.
CREATE INDEX IF NOT EXISTS idx_students_inst_class_roll 
ON students(institution_id, class_id, roll);

CREATE INDEX IF NOT EXISTS idx_students_year 
ON students(academic_year_id);

-- 2. Attendance Table Indexes
-- Fixed: 'roll' is not in 'attendance' table. Indexing by student_id and date for report joins.
CREATE INDEX IF NOT EXISTS idx_attendance_student_date 
ON attendance(student_id, date);

CREATE INDEX IF NOT EXISTS idx_attendance_inst_date_status 
ON attendance(institution_id, date, status);

CREATE INDEX IF NOT EXISTS idx_attendance_class_session 
ON attendance(class_id, session, date);

-- 3. Finance & Ledger Table Indexes
-- Accelerates accounting reports and daily summary.
CREATE INDEX IF NOT EXISTS idx_ledger_inst_date_type 
ON ledger(institution_id, transaction_date DESC, type);

CREATE INDEX IF NOT EXISTS idx_fee_structures_institution ON fee_structures(institution_id);

-- 4. Result/Exam calculation performance
CREATE INDEX IF NOT EXISTS idx_exam_marks_composite 
ON exam_marks(exam_id, student_id, subject_id);

-- 5. System Management
CREATE INDEX IF NOT EXISTS idx_profiles_institution ON profiles(institution_id);
CREATE INDEX IF NOT EXISTS idx_classes_institution_id ON classes(institution_id);
