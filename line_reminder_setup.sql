-- LINE Integration Database Setup
-- Run this in Supabase SQL Editor

-- 1. Add line_user_id column to members table
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS line_user_id TEXT;

-- 2. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_members_line_user_id 
ON members(line_user_id);

-- 3. Create system_settings table if not exists
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Insert LINE reminder settings
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES 
  ('line_reminder_enabled', 'false', 'Enable/disable LINE booking reminders'),
  ('line_channel_access_token', '', 'LINE Channel Access Token'),
  ('line_reminder_time', '19:00', 'Daily reminder time (HH:MM format)')
ON CONFLICT (setting_key) DO NOTHING;

-- 5. Enable RLS on system_settings
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for system_settings
-- Allow authenticated users to read settings
CREATE POLICY "Allow authenticated users to read system settings"
ON system_settings
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to update settings
CREATE POLICY "Allow authenticated users to update system settings"
ON system_settings
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 7. Create line_bindings table for tracking (optional, for audit)
CREATE TABLE IF NOT EXISTS line_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  line_user_id TEXT NOT NULL,
  bound_at TIMESTAMPTZ DEFAULT NOW(),
  unbound_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- 8. Create index on line_bindings
CREATE INDEX IF NOT EXISTS idx_line_bindings_member_id 
ON line_bindings(member_id);

CREATE INDEX IF NOT EXISTS idx_line_bindings_line_user_id 
ON line_bindings(line_user_id);

-- 9. Enable RLS on line_bindings
ALTER TABLE line_bindings ENABLE ROW LEVEL SECURITY;

-- 10. Create RLS policies for line_bindings
CREATE POLICY "Allow authenticated users to read line bindings"
ON line_bindings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert line bindings"
ON line_bindings
FOR INSERT
TO authenticated
WITH CHECK (true);

