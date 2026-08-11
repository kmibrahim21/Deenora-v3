DROP POLICY IF EXISTS "Enable read access for managers" ON transactions;
CREATE POLICY "Enable read access for managers" ON transactions FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'manager'
    )
);
