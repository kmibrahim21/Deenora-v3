-- Update sponsors table to include donor types and pledge information
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sponsors' AND column_name = 'donor_type') THEN
        ALTER TABLE sponsors ADD COLUMN donor_type TEXT DEFAULT 'general';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sponsors' AND column_name = 'monthly_pledge_amount') THEN
        ALTER TABLE sponsors ADD COLUMN monthly_pledge_amount DECIMAL(15, 2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sponsors' AND column_name = 'notes') THEN
        ALTER TABLE sponsors ADD COLUMN notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sponsors' AND column_name = 'status') THEN
        ALTER TABLE sponsors ADD COLUMN status TEXT DEFAULT 'active';
    END IF;
END $$;

-- Create donations table for dedicated donation tracking
CREATE TABLE IF NOT EXISTS donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    donor_id UUID REFERENCES sponsors(id) ON DELETE SET NULL,
    donor_name TEXT NOT NULL,
    donor_phone TEXT,
    donor_address TEXT,
    amount DECIMAL(15, 2) NOT NULL,
    fund_category TEXT NOT NULL, -- 'general', 'zakat', 'lillah', 'development', etc.
    payment_method TEXT NOT NULL DEFAULT 'cash',
    donation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    receipt_no TEXT NOT NULL,
    prayer_request TEXT,
    is_monthly_pledge BOOLEAN DEFAULT FALSE,
    ledger_id UUID REFERENCES ledger(id) ON DELETE SET NULL,
    collected_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS donations_institution_id_idx ON donations(institution_id);
CREATE INDEX IF NOT EXISTS donations_donor_id_idx ON donations(donor_id);
CREATE INDEX IF NOT EXISTS donations_donation_date_idx ON donations(donation_date);

-- RLS for donations
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON donations;
CREATE POLICY "Enable read access for authenticated users" ON donations
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable all access for institution admins" ON donations;
CREATE POLICY "Enable all access for institution admins" ON donations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.institution_id = donations.institution_id
            AND profiles.role IN ('madrasah_admin', 'accountant', 'super_admin')
        )
    );
