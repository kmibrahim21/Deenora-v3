# Supabase RLS Security Specification

## Overview
This document outlines the required Row Level Security (RLS) policies for the Madrasah Management System to prevent unauthorized data access or modifications.

## Data Invariants
1. A user can only access data belonging to their assigned `institution_id`.
2. Sensitive credentials (REVE API keys, PINs) should be protected.
3. Teachers should have restricted access compared to Madrasah Admins.

## RLS Policies by Table

### 1. `profiles`
- **Enable RLS:** Yes
- **Select:** `auth.uid() = id` (Users see themselves) OR `role = 'super_admin'` OR `(role = 'madrasah_admin' AND institution_id = profiles.institution_id)`
- **Update:** `auth.uid() = id` (Self-update) OR `role = 'madrasah_admin' AND institution_id = profiles.institution_id`

### 2. `institutions`
- **Enable RLS:** Yes
- **Select:** `id IN (SELECT institution_id FROM profiles WHERE id = auth.uid())`
- **Update:** `id IN (SELECT institution_id FROM profiles WHERE id = auth.uid() AND role = 'madrasah_admin')`

### 3. Core Madrasah Data (`students`, `classes`, `exams`, `attendance`, `fees`, `ledger`, etc.)
All these tables follow a similar pattern based on `institution_id`.
- **Enable RLS:** Yes
- **Select:** `institution_id IN (SELECT institution_id FROM profiles WHERE id = auth.uid())`
- **Insert/Update/Delete:** `institution_id IN (SELECT institution_id FROM profiles WHERE id = auth.uid() AND role IN ('madrasah_admin', 'super_admin'))`
  - *Note:* Teachers may need INSERT/UPDATE for `attendance` and `exam_marks` if allowed.

### 4. Public/Global Tables (`tutorials`, `subscription_packages`)
- **Enable RLS:** Yes
- **Select:** `true` (Authenticated users only)
- **Insert/Update/Delete:** `false` (Super Admin via Dashboard only)

## SQL Implementation Script
Copy and run this in the Supabase SQL Editor:

```sql
-- 1. Enable RLS for all tables
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sms_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE befaq_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE befaq_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE befaq_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_fee_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_templates ENABLE ROW LEVEL SECURITY;

-- 2. Define Helper Functions (Optional but recommended for performance)
CREATE OR REPLACE FUNCTION get_user_institution()
RETURNS uuid AS $$
  SELECT institution_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 3. Example Policy for 'students'
-- Users can only see students of their institution
CREATE POLICY "Users can view institution students" ON students
  FOR SELECT USING (institution_id = get_user_institution());

-- Only admins can modify students
CREATE POLICY "Admins can manage institution students" ON students
  FOR ALL TO authenticated USING (
    institution_id = get_user_institution() AND 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'madrasah_admin')
  );

-- [Repeat similar logic for other tables]
```
