-- Add hijri_start_date and hijri_end_date to academic_years
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS hijri_start_date TEXT;
ALTER TABLE academic_years ADD COLUMN IF NOT EXISTS hijri_end_date TEXT;

-- Update the promote_students RPC to accept hijri dates
CREATE OR REPLACE FUNCTION promote_students(
  p_institution_id UUID,
  p_new_year_name TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_promotions JSONB,
  p_hijri_start_date TEXT DEFAULT NULL,
  p_hijri_end_date TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_old_year_id UUID;
  v_new_year_id UUID;
  v_promo JSONB;
BEGIN
  -- 1. Get current active year
  SELECT id INTO v_old_year_id FROM academic_years 
  WHERE institution_id = p_institution_id AND status = 'active' 
  LIMIT 1;

  -- 2. Archive old year
  IF v_old_year_id IS NOT NULL THEN
    UPDATE academic_years SET status = 'archived' WHERE id = v_old_year_id;
  END IF;

  -- 3. Create new year
  INSERT INTO academic_years (
    institution_id, 
    year_name, 
    start_date, 
    end_date, 
    status,
    hijri_start_date,
    hijri_end_date
  )
  VALUES (
    p_institution_id, 
    p_new_year_name, 
    p_start_date, 
    p_end_date, 
    'active',
    p_hijri_start_date,
    p_hijri_end_date
  )
  RETURNING id INTO v_new_year_id;

  -- 4. Process promotions
  FOR v_promo IN SELECT * FROM jsonb_array_elements(p_promotions)
  LOOP
    -- Update student class
    UPDATE students 
    SET class_id = (v_promo->>'next_class_id')::UUID
    WHERE id = (v_promo->>'student_id')::UUID;

    -- Log promotion
    INSERT INTO promotion_logs (
      institution_id, 
      student_id, 
      from_class_id, 
      to_class_id, 
      academic_year_id
    ) VALUES (
      p_institution_id,
      (v_promo->>'student_id')::UUID,
      (SELECT class_id FROM students WHERE id = (v_promo->>'student_id')::UUID),
      (v_promo->>'next_class_id')::UUID,
      v_new_year_id
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
