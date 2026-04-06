
-- Add academic_year_id to relevant tables
ALTER TABLE students ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id);
ALTER TABLE exams ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id);
ALTER TABLE ledger ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id);
ALTER TABLE fees ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id);
ALTER TABLE final_results ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id);
ALTER TABLE befaq_exams ADD COLUMN IF NOT EXISTS academic_year_id UUID REFERENCES academic_years(id);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_students_academic_year ON students(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_exams_academic_year ON exams(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_attendance_academic_year ON attendance(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_ledger_academic_year ON ledger(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_fees_academic_year ON fees(academic_year_id);

-- Update existing records to point to the current active year
DO $$
DECLARE
    v_active_year_id UUID;
BEGIN
    SELECT id INTO v_active_year_id FROM academic_years WHERE status = 'active' LIMIT 1;
    
    IF v_active_year_id IS NOT NULL THEN
        UPDATE students SET academic_year_id = v_active_year_id WHERE academic_year_id IS NULL;
        UPDATE exams SET academic_year_id = v_active_year_id WHERE academic_year_id IS NULL;
        UPDATE attendance SET academic_year_id = v_active_year_id WHERE academic_year_id IS NULL;
        UPDATE ledger SET academic_year_id = v_active_year_id WHERE academic_year_id IS NULL;
        UPDATE fees SET academic_year_id = v_active_year_id WHERE academic_year_id IS NULL;
        UPDATE final_results SET academic_year_id = v_active_year_id WHERE academic_year_id IS NULL;
        UPDATE befaq_exams SET academic_year_id = v_active_year_id WHERE academic_year_id IS NULL;
    END IF;
END $$;

-- Updated promote_students RPC to handle academic_year_id
CREATE OR REPLACE FUNCTION promote_students(
  p_institution_id UUID,
  p_new_year_name TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_promotions JSONB
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
  INSERT INTO academic_years (institution_id, year_name, start_date, end_date, status)
  VALUES (p_institution_id, p_new_year_name, p_start_date, p_end_date, 'active')
  RETURNING id INTO v_new_year_id;

  -- 4. Process promotions
  FOR v_promo IN SELECT * FROM jsonb_array_elements(p_promotions)
  LOOP
    -- Update student class AND academic_year_id
    UPDATE students 
    SET 
      class_id = (v_promo->>'next_class_id')::UUID,
      academic_year_id = v_new_year_id
    WHERE id = (v_promo->>'student_id')::UUID;

    -- Log promotion
    INSERT INTO promotion_logs (
      institution_id, 
      student_id, 
      from_class,
      to_class,
      academic_year_from, 
      academic_year_to,
      executed_by
    ) VALUES (
      p_institution_id,
      (v_promo->>'student_id')::UUID,
      (v_promo->>'current_class_name'),
      (v_promo->>'next_class_name'),
      v_old_year_id,
      v_new_year_id,
      auth.uid()
    );
  END LOOP;

  -- 5. Update institution config_json with new academic_year_start
  UPDATE institutions 
  SET config_json = jsonb_set(
    COALESCE(config_json, '{}'::jsonb), 
    '{academic_year_start}', 
    to_jsonb(p_start_date::text)
  )
  WHERE id = p_institution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
