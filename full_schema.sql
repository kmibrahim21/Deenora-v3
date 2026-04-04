
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
    role TEXT CHECK (role IN ('super_admin', 'madrasah_admin', 'accountant', 'teacher')) DEFAULT 'madrasah_admin',
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
    roll INTEGER,
    guardian_name TEXT,
    guardian_phone TEXT NOT NULL,
    guardian_phone_2 TEXT,
    photo_url TEXT,
    student_type TEXT CHECK (student_type IN ('boarding', 'day_scholar')) DEFAULT 'day_scholar',
    department TEXT CHECK (department IN ('hifz', 'nazera', 'kitab', 'other')) DEFAULT 'kitab',
    sponsor_id UUID,
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
    status TEXT CHECK (status IN ('present', 'absent', 'late', 'half_day')) NOT NULL,
    date DATE NOT NULL,
    recorded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Ledger Entries (Accounting)
CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
    category TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT,
    transaction_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Fee Structures
CREATE TABLE IF NOT EXISTS fee_structures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    fee_name TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
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
    is_active BOOLEAN DEFAULT TRUE,
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

-- RPC Functions

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

ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read for institutions" ON institutions;
CREATE POLICY "Public read for institutions" ON institutions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Super admin all access for institutions" ON institutions;
CREATE POLICY "Super admin all access for institutions" ON institutions FOR ALL USING (check_is_super_admin());

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
CREATE POLICY "Super admins can view all profiles" ON profiles FOR SELECT USING (check_is_super_admin());

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON classes;
CREATE POLICY "Enable read access for authenticated users" ON classes FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable all access for institution admins" ON classes;
CREATE POLICY "Enable all access for institution admins" ON classes FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND institution_id = classes.institution_id AND role IN ('madrasah_admin', 'super_admin'))
);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON students;
CREATE POLICY "Enable read access for authenticated users" ON students FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Enable all access for institution admins" ON students;
CREATE POLICY "Enable all access for institution admins" ON students FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND institution_id = students.institution_id AND role IN ('madrasah_admin', 'super_admin', 'teacher'))
);

-- Add more RLS policies as needed...
