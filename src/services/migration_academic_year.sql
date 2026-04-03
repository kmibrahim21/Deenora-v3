-- Create academic_years table
CREATE TABLE IF NOT EXISTS academic_years (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  year_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT CHECK (status IN ('active', 'archived')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_academic_years_institution_id ON academic_years(institution_id);
CREATE INDEX IF NOT EXISTS idx_academic_years_status ON academic_years(status);

-- Create promotion_logs table
CREATE TABLE IF NOT EXISTS promotion_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  from_class TEXT NOT NULL,
  to_class TEXT NOT NULL,
  academic_year_from UUID REFERENCES academic_years(id),
  academic_year_to UUID REFERENCES academic_years(id),
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  executed_by UUID REFERENCES auth.users(id)
);

-- Create index for promotion logs
CREATE INDEX IF NOT EXISTS idx_promotion_logs_institution_id ON promotion_logs(institution_id);
CREATE INDEX IF NOT EXISTS idx_promotion_logs_student_id ON promotion_logs(student_id);

-- RLS Policies for academic_years
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON academic_years
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for institution admins" ON academic_years
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM institution_users WHERE institution_id = academic_years.institution_id AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Enable update for institution admins" ON academic_years
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM institution_users WHERE institution_id = academic_years.institution_id AND role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for promotion_logs
ALTER TABLE promotion_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for institution admins" ON promotion_logs
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM institution_users WHERE institution_id = promotion_logs.institution_id AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Enable insert for institution admins" ON promotion_logs
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM institution_users WHERE institution_id = promotion_logs.institution_id AND role IN ('admin', 'super_admin')
    )
  );

-- RPC Function for Promotion
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
    -- Update student class
    UPDATE students 
    SET class_id = (v_promo->>'next_class_id')::UUID
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
