-- ==============================================================================
-- DEENORA ERP: SMARTPHONE PUSH & IN-APP NOTIFICATION SYSTEM MIGRATION
-- Tables: notification_settings, app_notifications, device_tokens
-- Includes: Indexes, RLS Policies, Realtime Publication
-- ==============================================================================

BEGIN;

-- ১. notification_settings টেবিল (প্রতিটি প্রতিষ্ঠানের জন্য পুশ নোটিফিকেশন কনফিগারেশন)
CREATE TABLE IF NOT EXISTS public.notification_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL UNIQUE REFERENCES public.institutions(id) ON DELETE CASCADE,
    attendance_notify_enabled BOOLEAN DEFAULT false,
    fee_notify_enabled BOOLEAN DEFAULT false,
    absent_title TEXT DEFAULT 'অনুপস্থিতি নোটিফিকেশন',
    absent_body_template TEXT DEFAULT 'আস-সালামু আলাইকুম, {student_name} (রোল: {roll}, শ্রেণি: {class_name}) আজ {date} তারিখে ক্লাসে অনুপস্থিত রয়েছে।',
    present_title TEXT DEFAULT 'উপস্থিতি নোটিফিকেশন',
    present_body_template TEXT DEFAULT 'আস-সালামু আলাইকুম, {student_name} আজ {date} তারিখে যথাসময়ে ক্লাসে উপস্থিত হয়েছে।',
    fee_title TEXT DEFAULT 'ফি আদায় নোটিফিকেশন',
    fee_body_template TEXT DEFAULT 'আস-সালামু আলাইকুম, {student_name}-এর বেতন বাবদ {amount} ৳ সফলভাবে জমা হয়েছে। মাস: {month}।',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ২. app_notifications টেবিল (অভিভাবকদের ইন-অ্যাপ নোটিফিকেশন হিস্টোরি ও লগ)
CREATE TABLE IF NOT EXISTS public.app_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    guardian_phone TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'general', -- 'attendance', 'fee', 'general'
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ৩. device_tokens টেবিল (স্মার্টফোনের FCM ডিভাইস টোকেন ট্র্যাকিং)
CREATE TABLE IF NOT EXISTS public.device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fcm_token TEXT NOT NULL UNIQUE,
    phone TEXT,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    user_id TEXT,
    institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
    device_id TEXT,
    device_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ৪. পারফরম্যান্স ইনডেক্সিং (দ্রুত কুয়েরি ও কানেকশন সেইভ করার জন্য)
CREATE INDEX IF NOT EXISTS idx_notification_settings_inst ON public.notification_settings(institution_id);
CREATE INDEX IF NOT EXISTS idx_app_notif_phone ON public.app_notifications(guardian_phone);
CREATE INDEX IF NOT EXISTS idx_app_notif_student ON public.app_notifications(student_id);
CREATE INDEX IF NOT EXISTS idx_app_notif_inst ON public.app_notifications(institution_id);
CREATE INDEX IF NOT EXISTS idx_app_notif_created ON public.app_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_tokens_phone ON public.device_tokens(phone);
CREATE INDEX IF NOT EXISTS idx_device_tokens_student ON public.device_tokens(student_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON public.device_tokens(fcm_token);

-- ৫. Row Level Security (RLS) সক্রিয় ও অনুমতি কনফিগারেশন
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- notification_settings পলিসি
DROP POLICY IF EXISTS "notification_settings_all_access" ON public.notification_settings;
CREATE POLICY "notification_settings_all_access"
ON public.notification_settings
FOR ALL
USING (true)
WITH CHECK (true);

-- app_notifications পলিসি
DROP POLICY IF EXISTS "app_notifications_all_access" ON public.app_notifications;
CREATE POLICY "app_notifications_all_access"
ON public.app_notifications
FOR ALL
USING (true)
WITH CHECK (true);

-- device_tokens পলিসি
DROP POLICY IF EXISTS "device_tokens_all_access" ON public.device_tokens;
CREATE POLICY "device_tokens_all_access"
ON public.device_tokens
FOR ALL
USING (true)
WITH CHECK (true);

COMMIT;

-- ৬. Supabase Realtime পাবলিকেশনে app_notifications যুক্ত করা (লাইভ নোটিফিকেশন পপ-আপের জন্য)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_notifications;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
    WHEN others THEN
        NULL;
END $$;
