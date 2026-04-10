
-- Create subscription_packages table
CREATE TABLE IF NOT EXISTS subscription_packages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    rate DECIMAL(10, 2) NOT NULL,
    features TEXT[] DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE subscription_packages ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Public read for subscription_packages" ON subscription_packages;
CREATE POLICY "Public read for subscription_packages" ON subscription_packages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Super admin all access for subscription_packages" ON subscription_packages;
CREATE POLICY "Super admin all access for subscription_packages" ON subscription_packages FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'super_admin'
    )
);

-- Insert default packages
INSERT INTO subscription_packages (name, rate, features, sort_order)
VALUES 
('স্টার্টার', 0.50, ARRAY['শিক্ষার্থীদের বিবরণ', 'বাল্ক এসএমএস', 'শিক্ষক ব্যবস্থাপনা', 'একাডেমিক ক্যালেন্ডার'], 1),
('বেসিক', 0.75, ARRAY['শিক্ষার্থীদের বিবরণ', 'বাল্ক এসএমএস', 'ভয়েস কল', 'শিক্ষক ব্যবস্থাপনা', 'একাডেমিক ক্যালেন্ডার'], 2),
('স্মার্ট', 1.00, ARRAY['শিক্ষার্থীদের বিবরণ', 'বাল্ক এসএমএস', 'ভয়েস কল', 'হাজিরা', 'শিক্ষক ব্যবস্থাপনা', 'একাডেমিক ক্যালেন্ডার'], 3),
('একাডেমিক', 1.00, ARRAY['শিক্ষার্থীদের বিবরণ', 'বাল্ক এসএমএস', 'ভয়েস কল', 'পরীক্ষা', 'শিক্ষক ব্যবস্থাপনা', 'একাডেমিক ক্যালেন্ডার'], 4),
('স্ট্যান্ডার্ড', 1.50, ARRAY['শিক্ষার্থীদের বিবরণ', 'বাল্ক এসএমএস', 'ভয়েস কল', 'হাজিরা', 'পরীক্ষা', 'শিক্ষক ব্যবস্থাপনা', 'একাডেমিক ক্যালেন্ডার'], 5),
('ফিনান্স', 1.50, ARRAY['শিক্ষার্থীদের বিবরণ', 'বাল্ক এসএমএস', 'ভয়েস কল', 'ফি ও হিসাব', 'শিক্ষক ব্যবস্থাপনা', 'একাডেমিক ক্যালেন্ডার'], 6),
('প্রফেশনাল', 1.75, ARRAY['শিক্ষার্থীদের বিবরণ', 'বাল্ক এসএমএস', 'ভয়েস কল', 'হাজিরা অথবা পরীক্ষা', 'ফি ও হিসাব', 'শিক্ষক ব্যবস্থাপনা', 'একাডেমিক ক্যালেন্ডার'], 7),
('এন্টারপ্রাইজ', 2.50, ARRAY['শিক্ষার্থীদের বিবরণ', 'বাল্ক এসএমএস', 'ভয়েস কল', 'হাজিরা', 'পরীক্ষা', 'ফি ও হিসাব', 'শিক্ষক ব্যবস্থাপনা', 'একাডেমিক ক্যালেন্ডার'], 8)
ON CONFLICT DO NOTHING;
