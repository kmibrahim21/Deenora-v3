-- Fix RLS Policies for exams table
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
            AND role IN ('madrasah_admin', 'super_admin', 'accountant', 'teacher')
        )
    );

DROP POLICY IF EXISTS "Enable update for institution admins" ON exams;
CREATE POLICY "Enable update for institution admins" ON exams
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = exams.institution_id 
            AND role IN ('madrasah_admin', 'super_admin', 'accountant', 'teacher')
        )
    );

DROP POLICY IF EXISTS "Enable delete for institution admins" ON exams;
CREATE POLICY "Enable delete for institution admins" ON exams
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = exams.institution_id 
            AND role IN ('madrasah_admin', 'super_admin', 'accountant', 'teacher')
        )
    );

-- Fix RLS Policies for exam_subjects table
ALTER TABLE exam_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON exam_subjects;
CREATE POLICY "Enable read access for authenticated users" ON exam_subjects
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for institution admins" ON exam_subjects;
CREATE POLICY "Enable insert for institution admins" ON exam_subjects
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM exams e
            JOIN profiles p ON p.institution_id = e.institution_id
            WHERE e.id = exam_subjects.exam_id
            AND p.id = auth.uid()
            AND p.role IN ('madrasah_admin', 'super_admin', 'teacher')
        )
    );

DROP POLICY IF EXISTS "Enable update for institution admins" ON exam_subjects;
CREATE POLICY "Enable update for institution admins" ON exam_subjects
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM exams e
            JOIN profiles p ON p.institution_id = e.institution_id
            WHERE e.id = exam_subjects.exam_id
            AND p.id = auth.uid()
            AND p.role IN ('madrasah_admin', 'super_admin', 'teacher')
        )
    );

DROP POLICY IF EXISTS "Enable delete for institution admins" ON exam_subjects;
CREATE POLICY "Enable delete for institution admins" ON exam_subjects
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM exams e
            JOIN profiles p ON p.institution_id = e.institution_id
            WHERE e.id = exam_subjects.exam_id
            AND p.id = auth.uid()
            AND p.role IN ('madrasah_admin', 'super_admin', 'teacher')
        )
    );

-- Fix RLS Policies for befaq_exams table
ALTER TABLE befaq_exams ENABLE ROW LEVEL SECURITY;

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

-- Fix RLS Policies for befaq_results table
ALTER TABLE befaq_results ENABLE ROW LEVEL SECURITY;

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
ALTER TABLE exam_marks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON exam_marks;
CREATE POLICY "Enable read access for authenticated users" ON exam_marks
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for institution admins" ON exam_marks;
CREATE POLICY "Enable insert for institution admins" ON exam_marks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM exams e
            JOIN profiles p ON p.institution_id = e.institution_id
            WHERE e.id = exam_marks.exam_id
            AND p.id = auth.uid()
            AND p.role IN ('madrasah_admin', 'super_admin', 'teacher')
        )
    );

DROP POLICY IF EXISTS "Enable update for institution admins" ON exam_marks;
CREATE POLICY "Enable update for institution admins" ON exam_marks
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM exams e
            JOIN profiles p ON p.institution_id = e.institution_id
            WHERE e.id = exam_marks.exam_id
            AND p.id = auth.uid()
            AND p.role IN ('madrasah_admin', 'super_admin', 'teacher')
        )
    );

DROP POLICY IF EXISTS "Enable delete for institution admins" ON exam_marks;
CREATE POLICY "Enable delete for institution admins" ON exam_marks
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM exams e
            JOIN profiles p ON p.institution_id = e.institution_id
            WHERE e.id = exam_marks.exam_id
            AND p.id = auth.uid()
            AND p.role IN ('madrasah_admin', 'super_admin', 'teacher')
        )
    );
