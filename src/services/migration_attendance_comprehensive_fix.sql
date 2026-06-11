-- Comprehensive Attendance Fix
-- Resolves Multi-Session status conflicts and adds RPC helpers for dashboard and reports

DROP FUNCTION IF EXISTS get_attendance_report(UUID, DATE, DATE, TEXT);
DROP FUNCTION IF EXISTS get_daily_attendance_details(UUID, DATE, UUID, TEXT);
DROP FUNCTION IF EXISTS get_today_attendance_count(UUID, DATE, UUID, UUID[]);

-- 1. Daily Attendance Details RPC (Aggregated view for multi-session support)
CREATE OR REPLACE FUNCTION get_daily_attendance_details(
    p_institution_id UUID,
    p_date DATE,
    p_class_id UUID DEFAULT NULL,
    p_session TEXT DEFAULT NULL
)
RETURNS TABLE (
    student_id UUID,
    student_name TEXT,
    roll INTEGER,
    class_name TEXT,
    guardian_phone TEXT,
    final_status TEXT,
    arrival_time TEXT,
    session TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH daily_agg AS (
        SELECT 
            a.student_id,
            CASE 
                WHEN bool_or(a.status = 'present') THEN 'present'
                WHEN bool_or(a.status = 'late') THEN 'late'
                WHEN bool_or(a.status = 'half_day') THEN 'half_day'
                WHEN bool_or(a.status = 'leave') THEN 'leave'
                WHEN bool_or(a.status = 'absent') THEN 'absent'
                ELSE NULL
            END as aggregated_status,
            MAX(a.arrival_time) as max_arrival
        FROM attendance a
        WHERE a.institution_id = p_institution_id
          AND a.date = p_date
          AND (p_session IS NULL OR p_session = 'all' OR p_session = 'daily' OR a.session = p_session)
        GROUP BY a.student_id
    )
    SELECT 
        s.id::UUID as student_id,
        s.student_name::TEXT as student_name,
        s.roll::INTEGER as roll,
        c.class_name::TEXT as class_name,
        s.guardian_phone::TEXT as guardian_phone,
        da.aggregated_status::TEXT as final_status,
        da.max_arrival::TEXT as arrival_time,
        COALESCE(p_session, 'daily')::TEXT as session
    FROM students s
    JOIN classes c ON s.class_id = c.id
    JOIN daily_agg da ON s.id = da.student_id
    WHERE s.institution_id = p_institution_id
      AND (p_class_id IS NULL OR s.class_id = p_class_id);
END;
$$;

-- 2. Attendance Summary Report RPC
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
                WHEN bool_or(a.status = 'leave') THEN 'leave'
                WHEN bool_or(a.status = 'absent') THEN 'absent'
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

-- 3. Today Attendance Count RPC (Optimized for Dashboard)
CREATE OR REPLACE FUNCTION get_today_attendance_count(
    p_institution_id UUID,
    p_date DATE,
    p_academic_year_id UUID DEFAULT NULL,
    p_allowed_classes UUID[] DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count BIGINT;
BEGIN
    SELECT COUNT(DISTINCT a.student_id)::BIGINT
    INTO v_count
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    WHERE a.institution_id = p_institution_id
      AND a.date = p_date
      AND (a.status = 'present' OR a.status = 'late' OR a.status = 'half_day')
      AND (p_academic_year_id IS NULL OR s.academic_year_id = p_academic_year_id OR s.academic_year_id IS NULL)
      AND (p_allowed_classes IS NULL OR s.class_id = ANY(p_allowed_classes));
      
    RETURN v_count;
END;
$$;
