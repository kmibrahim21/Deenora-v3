-- Create Befaq Exams Table
CREATE TABLE IF NOT EXISTS befaq_exams (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    institution_id UUID REFERENCES profiles(institution_id) ON DELETE CASCADE,
    marhala_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    exam_name VARCHAR(255) NOT NULL,
    exam_year VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create Befaq Subjects Table
CREATE TABLE IF NOT EXISTS befaq_subjects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    exam_id UUID REFERENCES befaq_exams(id) ON DELETE CASCADE,
    subject_name VARCHAR(255) NOT NULL,
    total_marks INTEGER NOT NULL DEFAULT 100,
    passing_marks INTEGER NOT NULL DEFAULT 33,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create Befaq Results Table
CREATE TABLE IF NOT EXISTS befaq_results (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    exam_id UUID REFERENCES befaq_exams(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES befaq_subjects(id) ON DELETE CASCADE,
    marks_obtained INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(exam_id, student_id, subject_id)
);

-- Enable RLS
ALTER TABLE befaq_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE befaq_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE befaq_results ENABLE ROW LEVEL SECURITY;

-- Policies for befaq_exams
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON befaq_exams;
CREATE POLICY "Enable read access for authenticated users" ON befaq_exams
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for institution admins" ON befaq_exams;
CREATE POLICY "Enable insert for institution admins" ON befaq_exams
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = befaq_exams.institution_id 
            AND role IN ('madrasah_admin', 'super_admin', 'accountant', 'teacher')
        )
    );

DROP POLICY IF EXISTS "Enable update for institution admins" ON befaq_exams;
CREATE POLICY "Enable update for institution admins" ON befaq_exams
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = befaq_exams.institution_id 
            AND role IN ('madrasah_admin', 'super_admin', 'accountant', 'teacher')
        )
    );

DROP POLICY IF EXISTS "Enable delete for institution admins" ON befaq_exams;
CREATE POLICY "Enable delete for institution admins" ON befaq_exams
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = befaq_exams.institution_id 
            AND role IN ('madrasah_admin', 'super_admin', 'accountant', 'teacher')
        )
    );

-- Policies for befaq_subjects
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON befaq_subjects;
CREATE POLICY "Enable read access for authenticated users" ON befaq_subjects
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for institution admins" ON befaq_subjects;
CREATE POLICY "Enable insert for institution admins" ON befaq_subjects
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM befaq_exams be
            JOIN profiles p ON p.institution_id = be.institution_id
            WHERE be.id = befaq_subjects.exam_id
            AND p.id = auth.uid()
            AND p.role IN ('madrasah_admin', 'super_admin', 'accountant', 'teacher')
        )
    );

DROP POLICY IF EXISTS "Enable update for institution admins" ON befaq_subjects;
CREATE POLICY "Enable update for institution admins" ON befaq_subjects
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM befaq_exams be
            JOIN profiles p ON p.institution_id = be.institution_id
            WHERE be.id = befaq_subjects.exam_id
            AND p.id = auth.uid()
            AND p.role IN ('madrasah_admin', 'super_admin', 'accountant', 'teacher')
        )
    );

DROP POLICY IF EXISTS "Enable delete for institution admins" ON befaq_subjects;
CREATE POLICY "Enable delete for institution admins" ON befaq_subjects
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM befaq_exams be
            JOIN profiles p ON p.institution_id = be.institution_id
            WHERE be.id = befaq_subjects.exam_id
            AND p.id = auth.uid()
            AND p.role IN ('madrasah_admin', 'super_admin', 'accountant', 'teacher')
        )
    );

-- Policies for befaq_results
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON befaq_results;
CREATE POLICY "Enable read access for authenticated users" ON befaq_results
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for institution admins" ON befaq_results;
CREATE POLICY "Enable insert for institution admins" ON befaq_results
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM befaq_exams be
            JOIN profiles p ON p.institution_id = be.institution_id
            WHERE be.id = befaq_results.exam_id
            AND p.id = auth.uid()
            AND p.role IN ('madrasah_admin', 'super_admin', 'accountant', 'teacher')
        )
    );

DROP POLICY IF EXISTS "Enable update for institution admins" ON befaq_results;
CREATE POLICY "Enable update for institution admins" ON befaq_results
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM befaq_exams be
            JOIN profiles p ON p.institution_id = be.institution_id
            WHERE be.id = befaq_results.exam_id
            AND p.id = auth.uid()
            AND p.role IN ('madrasah_admin', 'super_admin', 'accountant', 'teacher')
        )
    );

DROP POLICY IF EXISTS "Enable delete for institution admins" ON befaq_results;
CREATE POLICY "Enable delete for institution admins" ON befaq_results
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM befaq_exams be
            JOIN profiles p ON p.institution_id = be.institution_id
            WHERE be.id = befaq_results.exam_id
            AND p.id = auth.uid()
            AND p.role IN ('madrasah_admin', 'super_admin', 'accountant', 'teacher')
        )
    );
