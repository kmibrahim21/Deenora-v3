-- Fix RLS Policies for fees table
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON fees;
CREATE POLICY "Enable read access for authenticated users" ON fees
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for institution admins" ON fees;
CREATE POLICY "Enable insert for institution admins" ON fees
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = fees.institution_id 
            AND role IN ('madrasah_admin', 'super_admin', 'accountant', 'teacher')
        )
    );

DROP POLICY IF EXISTS "Enable update for institution admins" ON fees;
CREATE POLICY "Enable update for institution admins" ON fees
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = fees.institution_id 
            AND role IN ('madrasah_admin', 'super_admin', 'accountant', 'teacher')
        )
    );

DROP POLICY IF EXISTS "Enable delete for institution admins" ON fees;
CREATE POLICY "Enable delete for institution admins" ON fees
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = fees.institution_id 
            AND role IN ('madrasah_admin', 'super_admin', 'accountant', 'teacher')
        )
    );

-- Create ledger table if it doesn't exist (code uses 'ledger' instead of 'ledger_entries')
CREATE TABLE IF NOT EXISTS ledger (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
    category TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT,
    transaction_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fix RLS Policies for ledger table
ALTER TABLE ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON ledger;
CREATE POLICY "Enable read access for authenticated users" ON ledger
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Enable insert for institution admins" ON ledger;
CREATE POLICY "Enable insert for institution admins" ON ledger
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = ledger.institution_id 
            AND role IN ('madrasah_admin', 'super_admin', 'accountant', 'teacher')
        )
    );

DROP POLICY IF EXISTS "Enable update for institution admins" ON ledger;
CREATE POLICY "Enable update for institution admins" ON ledger
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = ledger.institution_id 
            AND role IN ('madrasah_admin', 'super_admin', 'accountant', 'teacher')
        )
    );

DROP POLICY IF EXISTS "Enable delete for institution admins" ON ledger;
CREATE POLICY "Enable delete for institution admins" ON ledger
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND institution_id = ledger.institution_id 
            AND role IN ('madrasah_admin', 'super_admin', 'accountant', 'teacher')
        )
    );
