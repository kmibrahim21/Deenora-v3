-- Add session column to attendance table
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS session TEXT DEFAULT 'morning';

-- Update get_attendance_report to handle sessions
CREATE OR REPLACE FUNCTION get_attendance_report(
    p_class_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_session TEXT DEFAULT NULL
)
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    roll INTEGER,
    present_days BIGINT,
    absent_days BIGINT,
    late_days BIGINT,
    total_days BIGINT
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id as student_id,
        s.student_name,
        s.roll,
        COUNT(DISTINCT CASE WHEN a.status = 'present' THEN a.date END) as present_days,
        COUNT(DISTINCT CASE WHEN a.status = 'absent' THEN a.date END) as absent_days,
        COUNT(DISTINCT CASE WHEN a.status = 'late' THEN a.date END) as late_days,
        COUNT(DISTINCT a.date) as total_days
    FROM students s
    LEFT JOIN attendance a ON s.id = a.student_id 
        AND a.date >= p_start_date 
        AND a.date <= p_end_date
        AND (p_session IS NULL OR a.session = p_session)
    WHERE s.class_id = p_class_id
    GROUP BY s.id, s.student_name, s.roll
    ORDER BY s.roll ASC;
END;
$$;
