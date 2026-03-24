-- =========================================================================
-- TASKKER.IO - GLOBAL APP SETTINGS TABLE
-- Purpose: Store system-wide configuration like Company Name
-- =========================================================================

-- 1. Create the App Settings table
CREATE TABLE public.app_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. Enable Row Level Security
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 3. Create generic read/write policies for authenticated users 
-- (Our frontend RBAC will restrict writes to super_admins)
CREATE POLICY "Enable all operations for authenticated users on app_settings" 
ON public.app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Seed the initial Company Name property into the table
INSERT INTO public.app_settings (setting_key, setting_value)
VALUES ('company_name', 'TEAM ROOXTER')
ON CONFLICT (setting_key) DO NOTHING;
