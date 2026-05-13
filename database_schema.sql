-- Full Database Schema based on src/types.ts

-- Enum types (Optional, can also use text with constraints)
-- CREATE TYPE user_role AS ENUM ('super_admin', 'madrasah_admin', 'accountant', 'teacher');
-- CREATE TYPE inst_status AS ENUM ('active', 'suspended', 'trial');

-- Table: institutions
CREATE TABLE institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    institute_code TEXT,
    logo_url TEXT,
    institution_type TEXT NOT NULL DEFAULT 'madrasah',
    config_json JSONB DEFAULT '{}'::jsonb,
    theme TEXT DEFAULT 'light',
    status TEXT DEFAULT 'active',
    is_active BOOLEAN DEFAULT true,
    is_super_admin BOOLEAN DEFAULT false,
    email TEXT,
    balance NUMERIC DEFAULT 0,
    sms_balance INT DEFAULT 0,
    subscription_end TIMESTAMP WITH TIME ZONE,
    voice_sender_id TEXT,
    sms_rate NUMERIC,
    voice_rate NUMERIC,
    reve_api_key TEXT,
    reve_secret_key TEXT,
    reve_client_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: profiles
CREATE TABLE profiles (
    id UUID PRIMARY KEY, -- references auth.users
    institution_id UUID REFERENCES institutions(id),
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'teacher', -- super_admin, madrasah_admin, accountant, teacher
    is_active BOOLEAN DEFAULT true,
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: classes
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES institutions(id),
    class_name TEXT NOT NULL,
    sort_order INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: academic_years
CREATE TABLE academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES institutions(id),
    year_name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    hijri_start_date TEXT,
    hijri_end_date TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: students
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES institutions(id),
    class_id UUID REFERENCES classes(id),
    student_name TEXT NOT NULL,
    admission_number TEXT,
    roll INT,
    date_of_birth DATE,
    blood_group TEXT,
    guardian_name TEXT,
    mother_name TEXT,
    guardian_phone TEXT NOT NULL,
    guardian_phone_2 TEXT,
    address TEXT,
    notes TEXT,
    photo_url TEXT,
    student_type TEXT,
    department TEXT,
    sponsor_id UUID,
    academic_year_id UUID REFERENCES academic_years(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: teachers
CREATE TABLE teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    institution_id UUID REFERENCES institutions(id),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    pin TEXT,
    designation TEXT,
    basic_salary NUMERIC,
    is_active BOOLEAN DEFAULT true,
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: class_routines
CREATE TABLE class_routines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES institutions(id),
    class_id UUID REFERENCES classes(id),
    subject_name TEXT NOT NULL,
    teacher_id UUID REFERENCES teachers(id),
    day TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room_number TEXT,
    is_break BOOLEAN DEFAULT false,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: attendance
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES institutions(id),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id),
    status TEXT NOT NULL,
    date DATE NOT NULL,
    session TEXT,
    late_minutes INT,
    arrival_time TIME,
    recorded_by UUID,
    academic_year_id UUID REFERENCES academic_years(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: fees (transactions/fee tracking for students)
CREATE TABLE fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES institutions(id),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id),
    amount_paid NUMERIC NOT NULL,
    amount_due NUMERIC NOT NULL,
    discount NUMERIC,
    month TEXT NOT NULL, -- YYYY-MM
    status TEXT NOT NULL, -- paid, unpaid, partial
    paid_at TIMESTAMP WITH TIME ZONE,
    academic_year_id UUID REFERENCES academic_years(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: ledger_entries (for accounting)
CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES institutions(id),
    type TEXT NOT NULL, -- income / expense
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    description TEXT NOT NULL,
    transaction_date DATE NOT NULL,
    academic_year_id UUID REFERENCES academic_years(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: exams
CREATE TABLE exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES institutions(id),
    class_id UUID REFERENCES classes(id),
    exam_name TEXT NOT NULL,
    exam_date DATE NOT NULL,
    is_published BOOLEAN DEFAULT false,
    academic_year_id UUID REFERENCES academic_years(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: exam_subjects
CREATE TABLE exam_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    subject_name TEXT NOT NULL,
    full_marks NUMERIC NOT NULL,
    pass_marks NUMERIC NOT NULL,
    sort_order INT
);

-- Table: exam_marks
CREATE TABLE exam_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES exam_subjects(id) ON DELETE CASCADE,
    marks_obtained NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: final_results
CREATE TABLE final_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES institutions(id),
    class_id UUID REFERENCES classes(id),
    title TEXT NOT NULL,
    academic_year_id UUID REFERENCES academic_years(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: final_result_exams
CREATE TABLE final_result_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    final_result_id UUID REFERENCES final_results(id) ON DELETE CASCADE,
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    weight NUMERIC NOT NULL
);

-- Table: befaq_exams
CREATE TABLE befaq_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES institutions(id),
    exam_name TEXT NOT NULL,
    exam_year TEXT NOT NULL,
    marhala_id UUID REFERENCES classes(id),
    is_active BOOLEAN DEFAULT true,
    academic_year_id UUID REFERENCES academic_years(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: befaq_subjects
CREATE TABLE befaq_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES befaq_exams(id) ON DELETE CASCADE,
    subject_name TEXT NOT NULL,
    total_marks NUMERIC NOT NULL,
    passing_marks NUMERIC NOT NULL,
    sort_order INT
);

-- Table: befaq_results
CREATE TABLE befaq_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES befaq_exams(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES befaq_subjects(id) ON DELETE CASCADE,
    marks_obtained NUMERIC NOT NULL
);

-- Table: qawmi_result_configs
CREATE TABLE qawmi_result_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES institutions(id),
    config_name TEXT NOT NULL,
    grade_settings JSONB NOT NULL,
    pass_mark_settings JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- Table: sponsors
CREATE TABLE sponsors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES institutions(id),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: student_sponsorships
CREATE TABLE student_sponsorships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    sponsor_id UUID REFERENCES sponsors(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    status TEXT DEFAULT 'active'
);

-- Table: transactions (platform billing/SMS purchases)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES institutions(id),
    amount NUMERIC NOT NULL,
    transaction_id TEXT NOT NULL,
    sender_phone TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    sms_count INT,
    module TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: voices
CREATE TABLE voices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES institutions(id),
    title TEXT NOT NULL,
    file_url TEXT NOT NULL,
    provider_voice_id TEXT,
    provider_voice_name TEXT,
    admin_status TEXT DEFAULT 'pending',
    provider_status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: admin_sms_stock
CREATE TABLE admin_sms_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    remaining_sms INT DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: sms_templates
CREATE TABLE sms_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES institutions(id),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: calendar_events
CREATE TABLE calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES institutions(id),
    title TEXT NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    event_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: subscription_packages
CREATE TABLE subscription_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    rate NUMERIC NOT NULL,
    features JSONB DEFAULT '[]'::jsonb,
    sort_order INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table: promotion_logs
CREATE TABLE promotion_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES institutions(id),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    from_class_id UUID REFERENCES classes(id),
    to_class_id UUID REFERENCES classes(id),
    academic_year_from_id UUID REFERENCES academic_years(id),
    academic_year_to_id UUID REFERENCES academic_years(id),
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    status TEXT NOT NULL
);
