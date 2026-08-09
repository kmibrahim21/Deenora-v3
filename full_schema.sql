
-- Madrasah SaaS Management System - Full Database Schema
-- This script creates all necessary tables, functions, and RLS policies.

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Institutions Table
CREATE TABLE IF NOT EXISTS institutions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    logo_url TEXT,
    institution_type TEXT CHECK (institution_type IN ('madrasah', 'school', 'kindergarten', 'nurani', 'system')) DEFAULT 'madrasah',
    config_json JSONB DEFAULT '{
        "modules": {
            "attendance": true,
            "results": true,
            "admit_card": true,
            "seat_plan": true,
            "accounting": true,
            "academic_year_promotion": true,
            "voice_broadcast": true,
            "sms": true
        },
        "result_engine": "school",
        "result_system": "grading",
        "attendance_type": "daily",
        "fee_structure": "monthly",
        "ui_mode": "madrasah"
    }'::jsonb,
    theme TEXT DEFAULT 'emerald',
    status TEXT CHECK (status IN ('active', 'suspended', 'trial')) DEFAULT 'active',
    is_active BOOLEAN DEFAULT TRUE,
    is_super_admin BOOLEAN DEFAULT FALSE,
    email TEXT,
    login_code TEXT,
    balance DECIMAL(12, 2) DEFAULT 0,
    sms_balance INTEGER DEFAULT 0,
    reve_api_key TEXT,
    reve_secret_key TEXT,
    reve_caller_id TEXT,
    reve_client_id TEXT,
    subscription_end TIMESTAMPTZ,
    voice_sender_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Profiles Table (Linked to Auth Users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    role TEXT CHECK (role IN ('super_admin', 'madrasah_admin', 'manager', 'accountant', 'teacher')) DEFAULT 'madrasah_admin',
    permissions JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Classes Table
CREATE TABLE IF NOT EXISTS classes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    class_name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Students Table
CREATE TABLE IF NOT EXISTS students (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    student_name TEXT NOT NULL,
    admission_number TEXT,
    roll INTEGER,
    date_of_birth DATE,
    blood_group TEXT,
    guardian_name TEXT,
    mother_name TEXT,
    guardian_phone TEXT NOT NULL,
    guardian_phone_2 TEXT,
    address TEXT,
    photo_url TEXT,
    student_type TEXT CHECK (student_type IN ('boarding', 'day_scholar')) DEFAULT 'day_scholar',
    department TEXT CHECK (department IN ('hifz', 'nazera', 'kitab', 'other')) DEFAULT 'kitab',
    sponsor_id UUID,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    registration_number TEXT,
    section TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Teachers Table
CREATE TABLE IF NOT EXISTS teachers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    teacher_name TEXT NOT NULL,
    mobile TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    designation TEXT,
    photo_url TEXT,
    last_login_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Teacher Permissions (Detailed)
CREATE TABLE IF NOT EXISTS teacher_permissions (
    teacher_id UUID PRIMARY KEY REFERENCES teachers(id) ON DELETE CASCADE,
    can_manage_attendance BOOLEAN DEFAULT FALSE,
    can_manage_results BOOLEAN DEFAULT FALSE,
    can_manage_students BOOLEAN DEFAULT FALSE,
    can_manage_exams BOOLEAN DEFAULT FALSE,
    can_manage_accounting BOOLEAN DEFAULT FALSE,
    can_manage_classes BOOLEAN DEFAULT FALSE,
    can_manage_settings BOOLEAN DEFAULT FALSE,
    can_send_sms BOOLEAN DEFAULT FALSE,
    can_send_free_sms BOOLEAN DEFAULT FALSE,
    can_use_voice_call BOOLEAN DEFAULT FALSE,
    can_view_reports BOOLEAN DEFAULT FALSE,
    can_manage_teachers BOOLEAN DEFAULT FALSE,
    allowed_classes UUID[] DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Exams Table
CREATE TABLE IF NOT EXISTS exams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    exam_name TEXT NOT NULL,
    exam_date DATE NOT NULL,
    is_published BOOLEAN DEFAULT FALSE,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Exam Subjects
CREATE TABLE IF NOT EXISTS exam_subjects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    subject_name TEXT NOT NULL,
    full_marks INTEGER DEFAULT 100,
    pass_marks INTEGER DEFAULT 33
);

-- 9. Exam Marks
CREATE TABLE IF NOT EXISTS exam_marks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES exam_subjects(id) ON DELETE CASCADE,
    marks_obtained DECIMAL(5, 2) DEFAULT 0,
    UNIQUE(exam_id, student_id, subject_id)
);

-- 10. Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('present', 'absent', 'late', 'half_day')) NOT NULL,
    date DATE NOT NULL,
    session TEXT DEFAULT 'morning',
    recorded_by UUID REFERENCES auth.users(id),
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Ledger (Accounting)
CREATE TABLE IF NOT EXISTS ledger (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
    category TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT,
    transaction_date DATE NOT NULL,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Fee Structures
CREATE TABLE IF NOT EXISTS fee_structures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    fee_name TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Fees (Payments)
CREATE TABLE IF NOT EXISTS fees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    amount_paid DECIMAL(10, 2) DEFAULT 0,
    amount_due DECIMAL(10, 2) DEFAULT 0,
    discount DECIMAL(10, 2) DEFAULT 0,
    month TEXT NOT NULL, -- YYYY-MM
    status TEXT CHECK (status IN ('paid', 'unpaid', 'partial')) DEFAULT 'unpaid',
    paid_at TIMESTAMPTZ,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Student Fee Settings
CREATE TABLE IF NOT EXISTS student_fee_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    fee_structure_id UUID NOT NULL REFERENCES fee_structures(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, fee_structure_id)
);

-- 15. Academic Years
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

-- 16. Promotion Logs
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

-- 17. Tutorials
CREATE TABLE IF NOT EXISTS tutorials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    youtube_url TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. Voice Templates
CREATE TABLE IF NOT EXISTS voice_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    file_url TEXT NOT NULL,
    admin_status TEXT DEFAULT 'pending',
    provider_status TEXT DEFAULT 'pending',
    provider_voice_id TEXT,
    provider_voice_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. Calendar Events
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    event_type TEXT CHECK (event_type IN ('islamic', 'madrasah', 'holiday', 'closed')) DEFAULT 'madrasah',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 20. Sponsors
CREATE TABLE IF NOT EXISTS sponsors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. Student Sponsorships
CREATE TABLE IF NOT EXISTS student_sponsorships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 22. Transactions (Wallet/SMS Recharge)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    transaction_id TEXT NOT NULL,
    sender_phone TEXT NOT NULL,
    description TEXT,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    sms_count INTEGER DEFAULT 0,
    type TEXT CHECK (type IN ('credit', 'debit')) DEFAULT 'credit',
    module TEXT CHECK (module IN ('sms', 'voice', 'subscription')) DEFAULT 'sms',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 23. Admin SMS Stock
CREATE TABLE IF NOT EXISTS admin_sms_stock (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    remaining_sms INTEGER DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- 24. SMS Templates
CREATE TABLE IF NOT EXISTS sms_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 25. Final Results
CREATE TABLE IF NOT EXISTS final_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 26. Final Result Exams
CREATE TABLE IF NOT EXISTS final_result_exams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    final_result_id UUID NOT NULL REFERENCES final_results(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    weight DECIMAL(5, 2) DEFAULT 1.0
);

-- 27. Befaq Exams
CREATE TABLE IF NOT EXISTS befaq_exams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    exam_name TEXT NOT NULL,
    exam_year TEXT NOT NULL,
    marhala_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    class_name TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 28. Befaq Subjects
CREATE TABLE IF NOT EXISTS befaq_subjects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_id UUID NOT NULL REFERENCES befaq_exams(id) ON DELETE CASCADE,
    subject_name TEXT NOT NULL,
    total_marks INTEGER DEFAULT 100,
    passing_marks INTEGER DEFAULT 33
);

-- 29. Befaq Results
CREATE TABLE IF NOT EXISTS befaq_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    exam_id UUID NOT NULL REFERENCES befaq_exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES befaq_subjects(id) ON DELETE CASCADE,
    marks_obtained DECIMAL(5, 2) DEFAULT 0,
    UNIQUE(exam_id, student_id, subject_id)
);

-- 30. Qawmi Result Configs
CREATE TABLE IF NOT EXISTS qawmi_result_configs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    config_name TEXT NOT NULL,
    grade_settings JSONB DEFAULT '[]'::jsonb,
    pass_mark_settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 31. System Settings
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID DEFAULT '00000000-0000-0000-0000-000000000001'::UUID PRIMARY KEY,
    reve_api_key TEXT,
    reve_secret_key TEXT,
    reve_caller_id TEXT,
    reve_client_id TEXT,
    bkash_number TEXT,
    nagad_number TEXT,
    sms_rate DECIMAL(5, 2) DEFAULT 0.50,
    voice_rate DECIMAL(5, 2) DEFAULT 1.00,
    manager_permissions JSONB DEFAULT '{}'::jsonb,
    support_number TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RPC Functions

-- Drop existing functions first to avoid return type mismatch errors
DROP FUNCTION IF EXISTS check_teacher_login(TEXT, TEXT);
DROP FUNCTION IF EXISTS promote_students(UUID, TEXT, DATE, DATE, JSONB);
DROP FUNCTION IF EXISTS send_bulk_sms_rpc(UUID, UUID[], TEXT);
DROP FUNCTION IF EXISTS check_is_super_admin();
DROP FUNCTION IF EXISTS bootstrap_super_admin(UUID, TEXT);
DROP FUNCTION IF EXISTS get_monthly_dues_report(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS get_monthly_dues_report(UUID, UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS get_fee_reminder_list(UUID, TEXT);
DROP FUNCTION IF EXISTS get_fee_reminder_list(UUID, TEXT, UUID);

-- Check Teacher Login
CREATE OR REPLACE FUNCTION check_teacher_login(p_mobile TEXT, p_password_hash TEXT)
RETURNS TABLE (
    id UUID,
    institution_id UUID,
    teacher_name TEXT,
    mobile TEXT,
    designation TEXT,
    photo_url TEXT,
    is_active BOOLEAN,
    permissions JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.institution_id, t.teacher_name, t.mobile, t.designation, t.photo_url, t.is_active, t.permissions
    FROM teachers t
    WHERE t.mobile = p_mobile AND t.password_hash = p_password_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Promote Students
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
    -- Update student class and year
    UPDATE students 
    SET class_id = (v_promo->>'next_class_id')::UUID,
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

  -- 5. Update institution config_json with new academic_year_start and active_academic_year_id
  UPDATE institutions 
  SET config_json = jsonb_set(
    jsonb_set(
      COALESCE(config_json, '{}'::jsonb), 
      '{academic_year_start}', 
      to_jsonb(p_start_date::text)
    ),
    '{active_academic_year_id}',
    to_jsonb(v_new_year_id::text)
  )
  WHERE id = p_institution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get Monthly Dues Report
CREATE OR REPLACE FUNCTION get_monthly_dues_report(
  p_institution_id UUID,
  p_class_id UUID DEFAULT NULL,
  p_month TEXT DEFAULT NULL,
  p_academic_year_id UUID DEFAULT NULL
) RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  roll INTEGER,
  class_id UUID,
  class_name TEXT,
  guardian_phone TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id as student_id,
    s.student_name,
    s.roll,
    s.class_id,
    c.class_name,
    s.guardian_phone
  FROM students s
  LEFT JOIN classes c ON s.class_id = c.id
  WHERE s.institution_id = p_institution_id
    AND (p_class_id IS NULL OR s.class_id = p_class_id)
    AND (p_academic_year_id IS NULL OR s.academic_year_id = p_academic_year_id OR s.academic_year_id IS NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or Update get_fee_reminder_list to support p_academic_year_id
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
        SELECT SUM(fs.amount) 
        FROM fee_structures fs 
        LEFT JOIN student_fee_settings sfs ON sfs.fee_structure_id = fs.id AND sfs.student_id = s.id
        WHERE fs.institution_id = p_institution_id 
          AND (fs.class_id = s.class_id OR fs.class_id IS NULL)
          AND (sfs.is_enabled IS NULL OR sfs.is_enabled = true)
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
      WHEN (expected - paid) > (expected * 0.8) THEN 'final'
      WHEN (expected - paid) > (expected * 0.4) THEN 'strong'
      ELSE 'soft'
    END as r_type
  FROM student_fees
  WHERE (expected - paid) > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Send Bulk SMS RPC
CREATE OR REPLACE FUNCTION send_bulk_sms_rpc(
  p_institution_id UUID,
  p_student_ids UUID[],
  p_message TEXT
) RETURNS JSONB AS $$
DECLARE
  v_total_sms INTEGER;
  v_current_balance INTEGER;
BEGIN
  v_total_sms := array_length(p_student_ids, 1);
  
  SELECT sms_balance INTO v_current_balance FROM institutions WHERE id = p_institution_id;
  
  IF v_current_balance < v_total_sms THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient SMS balance');
  END IF;
  
  UPDATE institutions SET sms_balance = sms_balance - v_total_sms WHERE id = p_institution_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is super admin
CREATE OR REPLACE FUNCTION check_is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bootstrap Super Admin
CREATE OR REPLACE FUNCTION bootstrap_super_admin(p_uid UUID, p_email TEXT)
RETURNS VOID AS $$
BEGIN
    INSERT INTO profiles (id, full_name, role, is_active)
    VALUES (p_uid, 'Super Admin', 'super_admin', true)
    ON CONFLICT (id) DO UPDATE SET role = 'super_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies

-- 1. Institutions Table RLS
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read for institutions" ON institutions;
CREATE POLICY "Public read for institutions" ON institutions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Super admin all access for institutions" ON institutions;
CREATE POLICY "Super admin all access for institutions" ON institutions FOR ALL USING (check_is_super_admin());
DROP POLICY IF EXISTS "Institution admins can update their own institution" ON institutions;
CREATE POLICY "Institution admins can update their own institution" ON institutions FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND (
            (role = 'madrasah_admin' AND institution_id = institutions.id) OR
            (role = 'super_admin')
        )
    )
);

-- 2. Profiles Table RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
CREATE POLICY "Super admins can view all profiles" ON profiles FOR SELECT USING (check_is_super_admin());

-- 3. Classes Table RLS
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON classes;
CREATE POLICY "Enable read access for authenticated users" ON classes FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable all access for institution admins" ON classes;
CREATE POLICY "Enable all access for institution admins" ON classes FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (
            (profiles.role = 'madrasah_admin' AND profiles.institution_id = classes.institution_id) OR
            (profiles.role = 'super_admin')
        )
    )
);

-- 4. Students Table RLS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON students;
CREATE POLICY "Enable read access for authenticated users" ON students FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable all access for institution admins" ON students;
CREATE POLICY "Enable all access for institution admins" ON students FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (
            (profiles.role IN ('madrasah_admin', 'teacher') AND profiles.institution_id = students.institution_id) OR
            (profiles.role = 'super_admin')
        )
    )
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read for everyone" ON system_settings;
CREATE POLICY "Enable read for everyone" ON system_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable all for super admins" ON system_settings;
CREATE POLICY "Enable all for super admins" ON system_settings FOR ALL USING (check_is_super_admin());

-- Fees RLS
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON fees;
CREATE POLICY "Enable read access for authenticated users" ON fees FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable all access for institution admins" ON fees;
CREATE POLICY "Enable all access for institution admins" ON fees FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (
            (profiles.role IN ('madrasah_admin', 'accountant', 'teacher') AND profiles.institution_id = fees.institution_id) OR
            (profiles.role = 'super_admin')
        )
    )
);

-- Ledger RLS
ALTER TABLE ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON ledger;
CREATE POLICY "Enable read access for authenticated users" ON ledger FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable all access for institution admins" ON ledger;
CREATE POLICY "Enable all access for institution admins" ON ledger FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (
            (profiles.role IN ('madrasah_admin', 'accountant', 'teacher') AND profiles.institution_id = ledger.institution_id) OR
            (profiles.role = 'super_admin')
        )
    )
);

-- Exams RLS
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON exams;
CREATE POLICY "Enable read access for authenticated users" ON exams FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable all access for institution admins" ON exams;
CREATE POLICY "Enable all access for institution admins" ON exams FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (
            (profiles.role IN ('madrasah_admin', 'teacher') AND profiles.institution_id = exams.institution_id) OR
            (profiles.role = 'super_admin')
        )
    )
);

-- Fee Structures RLS
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON fee_structures;
CREATE POLICY "Enable read access for authenticated users" ON fee_structures FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable all access for institution admins" ON fee_structures;
CREATE POLICY "Enable all access for institution admins" ON fee_structures FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (
            (profiles.role IN ('madrasah_admin', 'accountant') AND profiles.institution_id = fee_structures.institution_id) OR
            (profiles.role = 'super_admin')
        )
    )
);

-- Academic Years RLS
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON academic_years;
CREATE POLICY "Enable read access for authenticated users" ON academic_years FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable all access for institution admins" ON academic_years;
CREATE POLICY "Enable all access for institution admins" ON academic_years FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (
            profiles.role = 'super_admin' OR 
            (profiles.role = 'madrasah_admin' AND profiles.institution_id = academic_years.institution_id)
        )
    )
) WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (
            profiles.role = 'super_admin' OR 
            (profiles.role = 'madrasah_admin' AND profiles.institution_id = academic_years.institution_id)
        )
    )
);

-- 16. Promotion Logs RLS
ALTER TABLE promotion_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for institution admins" ON promotion_logs;
CREATE POLICY "Enable read access for institution admins" ON promotion_logs FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND (
            (role = 'madrasah_admin' AND institution_id = promotion_logs.institution_id) OR
            (role = 'super_admin')
        )
    )
);
DROP POLICY IF EXISTS "Enable insert for institution admins" ON promotion_logs;
CREATE POLICY "Enable insert for institution admins" ON promotion_logs FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND (
            (role = 'madrasah_admin' AND institution_id = promotion_logs.institution_id) OR
            (role = 'super_admin')
        )
    )
);

-- 10. Attendance RLS
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON attendance;
CREATE POLICY "Enable read access for authenticated users" ON attendance FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable all access for institution admins" ON attendance;
CREATE POLICY "Enable all access for institution admins" ON attendance FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (
            (profiles.role IN ('madrasah_admin', 'teacher') AND profiles.institution_id = attendance.institution_id) OR
            (profiles.role = 'super_admin')
        )
    )
);

-- 9. Exam Marks RLS
ALTER TABLE exam_marks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON exam_marks;
CREATE POLICY "Enable read access for authenticated users" ON exam_marks FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable all access for institution admins" ON exam_marks;
CREATE POLICY "Enable all access for institution admins" ON exam_marks FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles p
        JOIN exams e ON e.id = exam_marks.exam_id
        WHERE p.id = auth.uid() 
        AND (
            (p.role IN ('madrasah_admin', 'teacher') AND p.institution_id = e.institution_id) OR
            (p.role = 'super_admin')
        )
    )
);

-- 8. Exam Subjects RLS
ALTER TABLE exam_subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON exam_subjects;
CREATE POLICY "Enable read access for authenticated users" ON exam_subjects FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable all access for institution admins" ON exam_subjects;
CREATE POLICY "Enable all access for institution admins" ON exam_subjects FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles p
        JOIN exams e ON e.id = exam_subjects.exam_id
        WHERE p.id = auth.uid() 
        AND (
            (p.role IN ('madrasah_admin', 'teacher') AND p.institution_id = e.institution_id) OR
            (p.role = 'super_admin')
        )
    )
);

-- 20. Sponsors RLS
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON sponsors;
CREATE POLICY "Enable read access for authenticated users" ON sponsors FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable all access for institution admins" ON sponsors;
CREATE POLICY "Enable all access for institution admins" ON sponsors FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (
            (profiles.role IN ('madrasah_admin', 'accountant') AND profiles.institution_id = sponsors.institution_id) OR
            (profiles.role = 'super_admin')
        )
    )
);

-- 21. Student Sponsorships RLS
ALTER TABLE student_sponsorships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON student_sponsorships;
CREATE POLICY "Enable read access for authenticated users" ON student_sponsorships FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable all access for institution admins" ON student_sponsorships;
CREATE POLICY "Enable all access for institution admins" ON student_sponsorships FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles p
        JOIN sponsors s ON s.id = student_sponsorships.sponsor_id
        WHERE p.id = auth.uid() 
        AND (
            (p.role IN ('madrasah_admin', 'accountant') AND p.institution_id = s.institution_id) OR
            (p.role = 'super_admin')
        )
    )
);

-- 25. Final Results RLS
ALTER TABLE final_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON final_results;
CREATE POLICY "Enable read access for authenticated users" ON final_results FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable all access for institution admins" ON final_results;
CREATE POLICY "Enable all access for institution admins" ON final_results FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (
            (profiles.role IN ('madrasah_admin', 'teacher') AND profiles.institution_id = final_results.institution_id) OR
            (profiles.role = 'super_admin')
        )
    )
);

-- 26. Final Result Exams RLS
ALTER TABLE final_result_exams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON final_result_exams;
CREATE POLICY "Enable read access for authenticated users" ON final_result_exams FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable all access for institution admins" ON final_result_exams;
CREATE POLICY "Enable all access for institution admins" ON final_result_exams FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles p
        JOIN final_results fr ON fr.id = final_result_exams.final_result_id
        WHERE p.id = auth.uid() 
        AND (
            (p.role IN ('madrasah_admin', 'teacher') AND p.institution_id = fr.institution_id) OR
            (p.role = 'super_admin')
        )
    )
);

-- 30. Qawmi Result Configs RLS
ALTER TABLE qawmi_result_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON qawmi_result_configs;
CREATE POLICY "Enable read access for authenticated users" ON qawmi_result_configs FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable all access for institution admins" ON qawmi_result_configs;
CREATE POLICY "Enable all access for institution admins" ON qawmi_result_configs FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (
            (profiles.role IN ('madrasah_admin', 'teacher') AND profiles.institution_id = qawmi_result_configs.institution_id) OR
            (profiles.role = 'super_admin')
        )
    )
);


-- 22. Transactions RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for institution admins" ON transactions;
CREATE POLICY "Enable read access for institution admins" ON transactions FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (
            (profiles.role IN ('madrasah_admin', 'accountant', 'teacher') AND profiles.institution_id = transactions.institution_id) OR
            (profiles.role = 'super_admin')
        )
    )
);
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON transactions;
CREATE POLICY "Enable insert for authenticated users" ON transactions FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (
            (profiles.role IN ('madrasah_admin', 'accountant', 'teacher') AND profiles.institution_id = transactions.institution_id) OR
            (profiles.role = 'super_admin')
        )
    )
);
DROP POLICY IF EXISTS "Enable all access for super admins" ON transactions;
CREATE POLICY "Enable all access for super admins" ON transactions FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'super_admin'
    )
);

-- 18. Voice Templates RLS
ALTER TABLE voice_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON voice_templates;
CREATE POLICY "Enable read access for authenticated users" ON voice_templates FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable all access for institution admins" ON voice_templates;
CREATE POLICY "Enable all access for institution admins" ON voice_templates FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (
            (profiles.role IN ('madrasah_admin', 'teacher') AND profiles.institution_id = voice_templates.institution_id) OR
            (profiles.role = 'super_admin')
        )
    )
);

-- 19. Calendar Events RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON calendar_events;
CREATE POLICY "Enable read access for authenticated users" ON calendar_events FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable all access for institution admins" ON calendar_events;
CREATE POLICY "Enable all access for institution admins" ON calendar_events FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (
            (profiles.role IN ('madrasah_admin', 'teacher') AND profiles.institution_id = calendar_events.institution_id) OR
            (profiles.role = 'super_admin')
        )
    )
);


-- 24. SMS Templates RLS
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON sms_templates;
CREATE POLICY "Enable read access for authenticated users" ON sms_templates FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable insert for institution admins" ON sms_templates;
CREATE POLICY "Enable insert for institution admins" ON sms_templates FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (
            (profiles.role IN ('madrasah_admin', 'teacher', 'accountant') AND profiles.institution_id = sms_templates.institution_id) OR
            (profiles.role = 'super_admin')
        )
    )
);
DROP POLICY IF EXISTS "Enable update/delete for institution admins" ON sms_templates;
CREATE POLICY "Enable update/delete for institution admins" ON sms_templates FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (
            (profiles.role IN ('madrasah_admin', 'teacher', 'accountant') AND profiles.institution_id = sms_templates.institution_id) OR
            (profiles.role = 'super_admin')
        )
    )
);

-- Befaq Exams RLS
ALTER TABLE befaq_exams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON befaq_exams;
CREATE POLICY "Enable read access for authenticated users" ON befaq_exams FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable all access for institution admins" ON befaq_exams;
CREATE POLICY "Enable all access for institution admins" ON befaq_exams FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND (
            (role IN ('madrasah_admin', 'accountant', 'teacher') AND institution_id = befaq_exams.institution_id) OR
            (role = 'super_admin')
        )
    )
);

-- Befaq Subjects RLS
ALTER TABLE befaq_subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON befaq_subjects;
CREATE POLICY "Enable read access for authenticated users" ON befaq_subjects FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable all access for institution admins" ON befaq_subjects;
CREATE POLICY "Enable all access for institution admins" ON befaq_subjects FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles p 
        JOIN befaq_exams e ON e.institution_id = p.institution_id OR p.role = 'super_admin'
        WHERE p.id = auth.uid() 
        AND e.id = befaq_subjects.exam_id 
        AND (
            (p.role IN ('madrasah_admin', 'teacher') AND p.institution_id = e.institution_id) OR
            (p.role = 'super_admin')
        )
    )
);

-- Befaq Results RLS
ALTER TABLE befaq_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON befaq_results;
CREATE POLICY "Enable read access for authenticated users" ON befaq_results FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable all access for institution admins" ON befaq_results;
CREATE POLICY "Enable all access for institution admins" ON befaq_results FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles p 
        JOIN befaq_exams e ON e.institution_id = p.institution_id OR p.role = 'super_admin'
        WHERE p.id = auth.uid() 
        AND e.id = befaq_results.exam_id 
        AND (
            (p.role IN ('madrasah_admin', 'accountant', 'teacher') AND p.institution_id = e.institution_id) OR
            (p.role = 'super_admin')
        )
    )
);

-- Student Fee Settings RLS
ALTER TABLE student_fee_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for institution admins" ON student_fee_settings;
CREATE POLICY "Enable read access for institution admins" ON student_fee_settings FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND (
            (role IN ('madrasah_admin', 'accountant', 'teacher') AND institution_id = student_fee_settings.institution_id) OR
            (role = 'super_admin')
        )
    )
);
DROP POLICY IF EXISTS "Enable all access for institution admins" ON student_fee_settings;
CREATE POLICY "Enable all access for institution admins" ON student_fee_settings FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND (
            (role IN ('madrasah_admin', 'accountant') AND institution_id = student_fee_settings.institution_id) OR
            (role = 'super_admin')
        )
    )
);

CREATE TABLE IF NOT EXISTS class_routines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_name TEXT NOT NULL,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    day TEXT NOT NULL CHECK (day IN ('Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room_number TEXT,
    is_break BOOLEAN DEFAULT FALSE,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for class_routines
ALTER TABLE class_routines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON class_routines;
CREATE POLICY "Enable read access for authenticated users" ON class_routines FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable all access for institution admins" ON class_routines;
CREATE POLICY "Enable all access for institution admins" ON class_routines FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND (
            (profiles.role = 'madrasah_admin' AND profiles.institution_id = class_routines.institution_id) OR
            (profiles.role = 'super_admin')
        )
    )
);

-- Attendance Helper Functions (Added for Multi-Session Support & Analytics)

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
        COUNT(ds.date)::BIGINT as total_days
    FROM students s
    LEFT JOIN daily_status ds ON s.id = ds.student_id 
    WHERE s.class_id = p_class_id
    GROUP BY s.id, s.student_name, s.roll
    ORDER BY s.roll ASC;
END;
$$;

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
      AND a.status = 'present'
      AND (p_academic_year_id IS NULL OR s.academic_year_id = p_academic_year_id OR s.academic_year_id IS NULL)
      AND (p_allowed_classes IS NULL OR s.class_id = ANY(p_allowed_classes));
      
    RETURN v_count;
END;
$$;
