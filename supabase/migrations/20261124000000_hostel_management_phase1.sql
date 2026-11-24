-- Phase 1: Hostel & Residential Management Module (hostel_rooms & hostel_allocations)
-- Strictly isolated per institution_id with RLS policies

CREATE TABLE IF NOT EXISTS hostel_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    building_name TEXT NOT NULL DEFAULT 'মূল ভবন',
    floor_name TEXT,
    room_number TEXT NOT NULL,
    room_title TEXT,
    gender TEXT NOT NULL DEFAULT 'male' CHECK (gender IN ('male', 'female', 'any')),
    capacity INTEGER NOT NULL DEFAULT 6 CHECK (capacity >= 1),
    monthly_seat_fee NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (monthly_seat_fee >= 0),
    warden_name TEXT,
    warden_phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hostel_rooms_institution_id_idx ON hostel_rooms(institution_id);
CREATE INDEX IF NOT EXISTS hostel_rooms_active_idx ON hostel_rooms(institution_id, is_active);

CREATE TABLE IF NOT EXISTS hostel_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    room_id UUID REFERENCES hostel_rooms(id) ON DELETE SET NULL,
    seat_number TEXT,
    residential_type TEXT NOT NULL DEFAULT 'residential' CHECK (residential_type IN ('residential', 'non_residential', 'day_care')),
    fee_category TEXT NOT NULL DEFAULT 'full_paid' CHECK (fee_category IN ('full_paid', 'half_free', 'lillah_free')),
    monthly_boarding_fee NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (monthly_boarding_fee >= 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'vacated')),
    allocated_at DATE DEFAULT CURRENT_DATE,
    vacated_at DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hostel_allocations_institution_id_idx ON hostel_allocations(institution_id);
CREATE INDEX IF NOT EXISTS hostel_allocations_student_id_idx ON hostel_allocations(institution_id, student_id, status);
CREATE INDEX IF NOT EXISTS hostel_allocations_room_id_idx ON hostel_allocations(institution_id, room_id, status);

-- Enable Row Level Security
ALTER TABLE hostel_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE hostel_allocations ENABLE ROW LEVEL SECURITY;

-- Policies for hostel_rooms
DROP POLICY IF EXISTS "Hostel rooms tenant read" ON hostel_rooms;
CREATE POLICY "Hostel rooms tenant read" ON hostel_rooms
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (
                profiles.role IN ('super_admin', 'manager')
                OR profiles.institution_id = hostel_rooms.institution_id
            )
        )
    );

DROP POLICY IF EXISTS "Hostel rooms tenant write" ON hostel_rooms;
CREATE POLICY "Hostel rooms tenant write" ON hostel_rooms
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (
                profiles.role IN ('super_admin', 'manager')
                OR (
                    profiles.institution_id = hostel_rooms.institution_id
                    AND profiles.role IN ('madrasah_admin', 'accountant', 'teacher')
                )
            )
        )
    );

-- Policies for hostel_allocations
DROP POLICY IF EXISTS "Hostel allocations tenant read" ON hostel_allocations;
CREATE POLICY "Hostel allocations tenant read" ON hostel_allocations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (
                profiles.role IN ('super_admin', 'manager')
                OR profiles.institution_id = hostel_allocations.institution_id
            )
        )
    );

DROP POLICY IF EXISTS "Hostel allocations tenant write" ON hostel_allocations;
CREATE POLICY "Hostel allocations tenant write" ON hostel_allocations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (
                profiles.role IN ('super_admin', 'manager')
                OR (
                    profiles.institution_id = hostel_allocations.institution_id
                    AND profiles.role IN ('madrasah_admin', 'accountant', 'teacher')
                )
            )
        )
    );
