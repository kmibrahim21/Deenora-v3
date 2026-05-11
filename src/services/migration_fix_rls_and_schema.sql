
-- 1. Fix students table schema: Add guardian_phone_2 if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='guardian_phone_2') THEN
        ALTER TABLE students ADD COLUMN guardian_phone_2 TEXT;
    END IF;
END $$;

-- 2. Create tutorials table if missing
CREATE TABLE IF NOT EXISTS tutorials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    youtube_url TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create voice_templates table if missing
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

-- 4. Create teacher_permissions table if missing
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

-- 5. Fix RLS Policies for fee_structures
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON fee_structures;
CREATE POLICY "Enable read access for authenticated users" ON fee_structures
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for institution admins" ON fee_structures;
CREATE POLICY "Enable insert for institution admins" ON fee_structures
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = fee_structures.institution_id 
            AND role IN ('madrasah_admin', 'super_admin', 'accountant')
        )
    );

DROP POLICY IF EXISTS "Enable update for institution admins" ON fee_structures;
CREATE POLICY "Enable update for institution admins" ON fee_structures
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = fee_structures.institution_id 
            AND role IN ('madrasah_admin', 'super_admin', 'accountant')
        )
    );

DROP POLICY IF EXISTS "Enable delete for institution admins" ON fee_structures;
CREATE POLICY "Enable delete for institution admins" ON fee_structures
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = fee_structures.institution_id 
            AND role IN ('madrasah_admin', 'super_admin', 'accountant')
        )
    );

-- 6. Fix RLS Policies for exams
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON exams;
CREATE POLICY "Enable read access for authenticated users" ON exams
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for institution admins" ON exams;
CREATE POLICY "Enable insert for institution admins" ON exams
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = exams.institution_id 
            AND role IN ('madrasah_admin', 'super_admin', 'teacher')
        )
    );

DROP POLICY IF EXISTS "Enable update for institution admins" ON exams;
CREATE POLICY "Enable update for institution admins" ON exams
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = exams.institution_id 
            AND role IN ('madrasah_admin', 'super_admin', 'teacher')
        )
    );

DROP POLICY IF EXISTS "Enable delete for institution admins" ON exams;
CREATE POLICY "Enable delete for institution admins" ON exams
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = exams.institution_id 
            AND role IN ('madrasah_admin', 'super_admin', 'teacher')
        )
    );

-- 7. Fix RLS Policies for calendar_events
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON calendar_events;
CREATE POLICY "Enable read access for authenticated users" ON calendar_events
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for institution admins" ON calendar_events;
CREATE POLICY "Enable insert for institution admins" ON calendar_events
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = calendar_events.institution_id 
            AND role IN ('madrasah_admin', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "Enable update for institution admins" ON calendar_events;
CREATE POLICY "Enable update for institution admins" ON calendar_events
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = calendar_events.institution_id 
            AND role IN ('madrasah_admin', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "Enable delete for institution admins" ON calendar_events;
CREATE POLICY "Enable delete for institution admins" ON calendar_events
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = calendar_events.institution_id 
            AND role IN ('madrasah_admin', 'super_admin')
        )
    );

-- 8. RLS Policies for tutorials (Public Read, Super Admin Write)
ALTER TABLE tutorials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for everyone" ON tutorials;
CREATE POLICY "Enable read access for everyone" ON tutorials
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable all access for super admins" ON tutorials;
CREATE POLICY "Enable all access for super admins" ON tutorials
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
    );

-- 9. RLS Policies for voice_templates
ALTER TABLE voice_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON voice_templates;
CREATE POLICY "Enable read access for authenticated users" ON voice_templates
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for institution admins" ON voice_templates;
CREATE POLICY "Enable insert for institution admins" ON voice_templates
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = voice_templates.institution_id 
            AND role IN ('madrasah_admin', 'super_admin')
        )
    );

-- 10. Ensure profiles table has correct RLS and fix infinite recursion
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is super admin without recursion
-- SECURITY DEFINER bypasses RLS for the query inside the function
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

DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;

CREATE POLICY "Users can view their own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Super admins can view all profiles" ON profiles
    FOR SELECT USING (check_is_super_admin());

-- 11. Bootstrap Super Admin Function (if not exists)
CREATE OR REPLACE FUNCTION bootstrap_super_admin(p_uid UUID, p_email TEXT)
RETURNS VOID AS $$
BEGIN
    INSERT INTO profiles (id, full_name, role, is_active)
    VALUES (p_uid, 'Super Admin', 'super_admin', true)
    ON CONFLICT (id) DO UPDATE SET role = 'super_admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Add Super Admin Teacher for bypass login
-- This allows logging in via Teacher Login with Email and PIN
-- Using teacher_name instead of name based on schema error
INSERT INTO teachers (institution_id, teacher_name, mobile, password_hash, designation, is_active, permissions)
SELECT 
    id, 
    'Super Admin', 
    'kmibrahim@gmail.com', 
    encode(digest('269596', 'sha256'), 'hex'), 
    'System Administrator', 
    true, 
    '{"dashboard":true,"institutions":true,"approvals":true,"can_manage_teachers":true,"can_manage_students":true}'::jsonb
FROM institutions 
WHERE institution_type = 'system' OR name = 'Super Admin'
LIMIT 1
ON CONFLICT (mobile) DO UPDATE SET password_hash = encode(digest('269596', 'sha256'), 'hex'), is_active = true;

-- 13. Create student_fee_settings table
CREATE TABLE IF NOT EXISTS student_fee_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    fee_structure_id UUID NOT NULL REFERENCES fee_structures(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, fee_structure_id)
);

ALTER TABLE student_fee_settings ENABLE ROW LEVEL SECURITY;

-- RLS for student_fee_settings
DROP POLICY IF EXISTS "Enable read access for institution admins" ON student_fee_settings;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON student_fee_settings;
CREATE POLICY "Enable read access for authenticated users" ON student_fee_settings
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for institution admins" ON student_fee_settings;
CREATE POLICY "Enable insert for institution admins" ON student_fee_settings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = student_fee_settings.institution_id 
            AND role IN ('madrasah_admin', 'super_admin', 'accountant')
        )
    );

DROP POLICY IF EXISTS "Enable update for institution admins" ON student_fee_settings;
CREATE POLICY "Enable update for institution admins" ON student_fee_settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = student_fee_settings.institution_id 
            AND role IN ('madrasah_admin', 'super_admin', 'accountant')
        )
    );

DROP POLICY IF EXISTS "Enable delete for institution admins" ON student_fee_settings;
CREATE POLICY "Enable delete for institution admins" ON student_fee_settings
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = student_fee_settings.institution_id 
            AND role IN ('madrasah_admin', 'super_admin', 'accountant')
        )
    );
