-- Phase 2: Hostel Daily Meal Attendance & Live Kitchen Dashboard
-- Creates hostel_meal_logs and hostel_leaves tables with strict institution_id tenant isolation

CREATE TABLE IF NOT EXISTS hostel_meal_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    morning TEXT NOT NULL DEFAULT 'present' CHECK (morning IN ('present', 'half', 'off')),
    noon TEXT NOT NULL DEFAULT 'present' CHECK (noon IN ('present', 'half', 'off')),
    night TEXT NOT NULL DEFAULT 'present' CHECK (night IN ('present', 'half', 'off')),
    note TEXT,
    recorded_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT hostel_meal_logs_unique_student_day UNIQUE (institution_id, student_id, log_date)
);

CREATE INDEX IF NOT EXISTS hostel_meal_logs_inst_date_idx ON hostel_meal_logs(institution_id, log_date);
CREATE INDEX IF NOT EXISTS hostel_meal_logs_student_idx ON hostel_meal_logs(institution_id, student_id);

CREATE TABLE IF NOT EXISTS hostel_leaves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    guardian_name TEXT,
    guardian_phone TEXT,
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'out', 'returned', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hostel_leaves_inst_dates_idx ON hostel_leaves(institution_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS hostel_leaves_student_idx ON hostel_leaves(institution_id, student_id, status);

-- Enable Row Level Security
ALTER TABLE hostel_meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hostel_leaves ENABLE ROW LEVEL SECURITY;

-- Policies for hostel_meal_logs
DROP POLICY IF EXISTS "Hostel meal logs tenant read" ON hostel_meal_logs;
CREATE POLICY "Hostel meal logs tenant read" ON hostel_meal_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (
                profiles.role IN ('super_admin', 'manager')
                OR profiles.institution_id = hostel_meal_logs.institution_id
            )
        )
    );

DROP POLICY IF EXISTS "Hostel meal logs tenant write" ON hostel_meal_logs;
CREATE POLICY "Hostel meal logs tenant write" ON hostel_meal_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (
                profiles.role IN ('super_admin', 'manager')
                OR (
                    profiles.institution_id = hostel_meal_logs.institution_id
                    AND profiles.role IN ('madrasah_admin', 'accountant', 'teacher')
                )
            )
        )
    );

-- Policies for hostel_leaves
DROP POLICY IF EXISTS "Hostel leaves tenant read" ON hostel_leaves;
CREATE POLICY "Hostel leaves tenant read" ON hostel_leaves
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (
                profiles.role IN ('super_admin', 'manager')
                OR profiles.institution_id = hostel_leaves.institution_id
            )
        )
    );

DROP POLICY IF EXISTS "Hostel leaves tenant write" ON hostel_leaves;
CREATE POLICY "Hostel leaves tenant write" ON hostel_leaves
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (
                profiles.role IN ('super_admin', 'manager')
                OR (
                    profiles.institution_id = hostel_leaves.institution_id
                    AND profiles.role IN ('madrasah_admin', 'accountant', 'teacher')
                )
            )
        )
    );
