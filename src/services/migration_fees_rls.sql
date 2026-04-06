-- Fix RLS Policies for fees
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

-- Fix RLS Policies for ledger
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
