-- Migration: Fix get_fee_reminder_list to filter out inactive students
CREATE OR REPLACE FUNCTION get_fee_reminder_list(
  p_institution_id UUID,
  p_month TEXT,
  p_academic_year_id UUID DEFAULT NULL
) RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  class_name TEXT,
  guardian_phone TEXT,
  total_payable DECIMAL,
  total_paid DECIMAL,
  balance_due DECIMAL,
  reminder_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH student_fees AS (
    SELECT 
      s.id as s_id,
      s.student_name as s_name,
      c.class_name as c_name,
      s.guardian_phone as g_phone,
      COALESCE((
        SELECT SUM(COALESCE(sfs.custom_amount, fs.amount)) 
        FROM fee_structures fs 
        LEFT JOIN student_fee_settings sfs ON sfs.fee_structure_id = fs.id AND sfs.student_id = s.id
        WHERE fs.institution_id = p_institution_id 
          AND (fs.class_id = s.class_id OR fs.class_id IS NULL)
          AND (sfs.is_enabled IS NULL OR sfs.is_enabled = true)
          -- Filter only structures that are active for the evaluated month (p_month)
          AND (fs.due_date IS NULL OR to_char(fs.due_date, 'YYYY-MM') >= p_month)
          AND (fs.start_date IS NULL OR to_char(fs.start_date, 'YYYY-MM') <= p_month)
      ), 0) as expected,
      COALESCE((
        SELECT SUM(f.amount_paid + f.discount) 
        FROM fees f 
        WHERE f.student_id = s.id 
          AND f.month = p_month
          AND (p_academic_year_id IS NULL OR f.academic_year_id = p_academic_year_id)
      ), 0) as paid
    FROM students s
    JOIN classes c ON s.class_id = c.id
    WHERE s.institution_id = p_institution_id
      AND (p_academic_year_id IS NULL OR s.academic_year_id = p_academic_year_id)
      AND (s.is_active = true OR s.is_active IS NULL)
  )
  SELECT 
    s_id,
    s_name,
    c_name,
    g_phone,
    expected,
    paid,
    (expected - paid) as balance,
    CASE 
      WHEN expected > 0 AND (expected - paid) > (expected * 0.8) THEN 'final'
      WHEN expected > 0 AND (expected - paid) > (expected * 0.4) THEN 'strong'
      ELSE 'soft'
    END as r_type
  FROM student_fees
  WHERE (expected - paid) > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
