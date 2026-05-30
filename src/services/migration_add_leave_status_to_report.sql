-- Adds leave status to the attendance reports

DROP FUNCTION IF EXISTS get_attendance_report(UUID, DATE, DATE, TEXT);

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
    half_days BIGINT,
    leave_days BIGINT,
    total_days BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH daily_status AS (
        SELECT 
            a.student_id,
            a.date,
            CASE 
                WHEN bool_or(a.status = 'present') THEN 'present'
                WHEN bool_or(a.status = 'late') THEN 'late'
                WHEN bool_or(a.status = 'half_day') THEN 'half_day'
                WHEN bool_or(a.status = 'absent') THEN 'absent'
                WHEN bool_or(a.status = 'leave') THEN 'leave'
                ELSE NULL
            END as final_status
        FROM attendance a
        WHERE a.date >= p_start_date 
          AND a.date <= p_end_date
          AND (p_session IS NULL OR p_session = 'all' OR p_session = 'daily' OR a.session = p_session)
        GROUP BY a.student_id, a.date
    )
    SELECT 
        s.id::UUID as student_id,
        s.student_name::TEXT as student_name,
        s.roll::INTEGER as roll,
        COUNT(CASE WHEN ds.final_status = 'present' THEN 1 END)::BIGINT as present_days,
        COUNT(CASE WHEN ds.final_status = 'absent' THEN 1 END)::BIGINT as absent_days,
        COUNT(CASE WHEN ds.final_status = 'late' THEN 1 END)::BIGINT as late_days,
        COUNT(CASE WHEN ds.final_status = 'half_day' THEN 1 END)::BIGINT as half_days,
        COUNT(CASE WHEN ds.final_status = 'leave' THEN 1 END)::BIGINT as leave_days,
        COUNT(ds.date)::BIGINT as total_days
    FROM students s
    LEFT JOIN daily_status ds ON s.id = ds.student_id 
    WHERE s.class_id = p_class_id
    GROUP BY s.id, s.student_name, s.roll
    ORDER BY s.roll ASC;
END;
$$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
