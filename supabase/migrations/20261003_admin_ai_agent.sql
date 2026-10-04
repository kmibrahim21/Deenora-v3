-- ==============================================================================
-- Deenora Admin AI Agent: Database Migration
-- Version: 1.0 (2026-10-03)
-- Description: Adds tables and columns for dual-mode Gemini AI key, audit logs, and daily usage.
-- ==============================================================================

-- 1. Add encrypted custom Gemini API key column to institutions table (BYOK)
ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS custom_gemini_key_encrypted TEXT;

-- 2. Audit log table — tracks all tool calls executed by the AI Agent
CREATE TABLE IF NOT EXISTS agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institute_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL,
  tool_name TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}',
  result_summary TEXT,
  mode TEXT NOT NULL DEFAULT 'shared', -- 'shared' | 'byok'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_actions_institute_idx
  ON agent_actions(institute_id, created_at DESC);

-- 3. Daily quota counter (tracks shared-key usage per institute per day)
CREATE TABLE IF NOT EXISTS agent_usage (
  institute_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  requests INT NOT NULL DEFAULT 0,
  PRIMARY KEY (institute_id, usage_date)
);

CREATE INDEX IF NOT EXISTS agent_usage_inst_date_idx
  ON agent_usage(institute_id, usage_date);
