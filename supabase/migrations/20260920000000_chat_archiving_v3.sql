-- ==============================================================================
-- DEENORA COMMUNICATION V3: AUTOMATIC CHAT ARCHIVING & STORAGE OPTIMIZATION
-- ==============================================================================

-- 1. Table: chat_retention_policies
CREATE TABLE IF NOT EXISTS chat_retention_policies (
    institution_id UUID PRIMARY KEY REFERENCES institutions(id) ON DELETE CASCADE,
    hot_retention_days INT NOT NULL DEFAULT 90, -- 0-90 days hot messages in Supabase
    announcement_retention_mode TEXT NOT NULL DEFAULT 'permanent', -- 'permanent' | 'days'
    announcement_retention_days INT DEFAULT 365,
    protect_pinned_messages BOOLEAN NOT NULL DEFAULT true,
    protect_starred_messages BOOLEAN NOT NULL DEFAULT true,
    auto_archive_enabled BOOLEAN NOT NULL DEFAULT true,
    archive_granularity TEXT NOT NULL DEFAULT 'per_conversation_month', -- 'per_conversation_month' | 'per_institution_month' | 'per_academic_year'
    storage_destination TEXT NOT NULL DEFAULT 'local_encrypted', -- 'supabase_storage_cold' | 'local_encrypted' | 'google_drive'
    last_archive_run_at TIMESTAMP WITH TIME ZONE,
    last_cleanup_run_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Table: chat_archives (Archive Metadata - zero raw message content duplicates)
CREATE TABLE IF NOT EXISTS chat_archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    conversation_id TEXT, -- specific conversation ID or 'all'
    conversation_name TEXT,
    date_start TIMESTAMP WITH TIME ZONE NOT NULL,
    date_end TIMESTAMP WITH TIME ZONE NOT NULL,
    message_count INT NOT NULL DEFAULT 0,
    archive_size_bytes BIGINT NOT NULL DEFAULT 0,
    compressed_size_bytes BIGINT,
    checksum TEXT NOT NULL, -- SHA-256 integrity hash
    encryption_version TEXT NOT NULL DEFAULT 'AES-256-GCM-V3',
    storage_location TEXT NOT NULL DEFAULT 'local_encrypted', -- 'supabase_storage' | 'local_encrypted' | 'google_drive'
    storage_path TEXT,
    status TEXT NOT NULL DEFAULT 'created', -- 'created', 'verified', 'cleaned_up', 'failed'
    crypto_metadata JSONB DEFAULT '{}'::jsonb,
    encrypted_package_url TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    cleaned_up_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Table: chat_archive_audit_logs
CREATE TABLE IF NOT EXISTS chat_archive_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    archive_id UUID REFERENCES chat_archives(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'archive_created', 'archive_verified', 'cleanup_started', 'cleanup_completed', 'cleanup_failed', 'restore_performed'
    affected_message_count INT DEFAULT 0,
    date_range JSONB,
    details TEXT,
    performed_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Performance Indexing
CREATE INDEX IF NOT EXISTS idx_chat_archives_inst ON chat_archives(institution_id);
CREATE INDEX IF NOT EXISTS idx_chat_archives_conv ON chat_archives(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_archives_status ON chat_archives(status);
CREATE INDEX IF NOT EXISTS idx_chat_archives_dates ON chat_archives(date_start, date_end);
CREATE INDEX IF NOT EXISTS idx_chat_audit_logs_inst ON chat_archive_audit_logs(institution_id, created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE chat_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_archive_audit_logs ENABLE ROW LEVEL SECURITY;

-- Multi-Tenant RLS Security Policies

-- Policies for chat_retention_policies
DROP POLICY IF EXISTS "Enable read access for authenticated members" ON chat_retention_policies;
CREATE POLICY "Enable read access for authenticated members" ON chat_retention_policies
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.institution_id = chat_retention_policies.institution_id
        )
    );

DROP POLICY IF EXISTS "Enable write access for institution admins" ON chat_retention_policies;
CREATE POLICY "Enable write access for institution admins" ON chat_retention_policies
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.institution_id = chat_retention_policies.institution_id
            AND profiles.role IN ('madrasah_admin', 'super_admin')
        )
    );

-- Policies for chat_archives
DROP POLICY IF EXISTS "Enable read access for institution members" ON chat_archives;
CREATE POLICY "Enable read access for institution members" ON chat_archives
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.institution_id = chat_archives.institution_id
        )
    );

DROP POLICY IF EXISTS "Enable admin write access for chat_archives" ON chat_archives;
CREATE POLICY "Enable admin write access for chat_archives" ON chat_archives
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.institution_id = chat_archives.institution_id
            AND profiles.role IN ('madrasah_admin', 'super_admin')
        )
    );

-- Policies for chat_archive_audit_logs
DROP POLICY IF EXISTS "Enable read access for institution admins on audit logs" ON chat_archive_audit_logs;
CREATE POLICY "Enable read access for institution admins on audit logs" ON chat_archive_audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.institution_id = chat_archive_audit_logs.institution_id
            AND profiles.role IN ('madrasah_admin', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "Enable insert for authenticated app system" ON chat_archive_audit_logs;
CREATE POLICY "Enable insert for authenticated app system" ON chat_archive_audit_logs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.institution_id = chat_archive_audit_logs.institution_id
        )
    );
