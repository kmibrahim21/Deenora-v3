-- Optimizations specifically for the Parent App load
-- Providing fast lookup paths to avoid heavy table scans when parents log in or check data

-- 1. Indexes for phone number lookups (usually how parents log in or link students)
CREATE INDEX IF NOT EXISTS idx_students_guardian_phone ON students(guardian_phone);
CREATE INDEX IF NOT EXISTS idx_students_guardian_phone_2 ON students(guardian_phone_2);

-- 2. Indexes for ID cards / admission number lookups
CREATE INDEX IF NOT EXISTS idx_students_admission_number ON students(admission_number);
CREATE INDEX IF NOT EXISTS idx_students_registration_number ON students(registration_number);

-- 3. Composite Index for Fees
-- Parents often check fees by student_id and academic_year_id or month
CREATE INDEX IF NOT EXISTS idx_fees_student_year_month ON fees(student_id, academic_year_id, month);

-- 4. Composite index for Attendance
-- Parents check attendance by student_id and date ranges
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);

-- 5. RPC to fetch all children linked to a phone number quickly (less roundtrips)
CREATE OR REPLACE FUNCTION get_parent_children(p_phone VARCHAR)
RETURNS TABLE (
  id UUID,
  student_name VARCHAR,
  roll INTEGER,
  admission_number VARCHAR,
  class_name VARCHAR,
  institution_id UUID,
  institution_name VARCHAR,
  photo_url TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.student_name,
    s.roll,
    s.admission_number,
    c.class_name,
    s.institution_id,
    i.name as institution_name,
    s.photo_url
  FROM students s
  LEFT JOIN classes c ON s.class_id = c.id
  LEFT JOIN institutions i ON s.institution_id = i.id
  WHERE (s.guardian_phone = p_phone OR s.guardian_phone_2 = p_phone)
    AND i.is_active = true;
END;
$$;

-- Inform PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
