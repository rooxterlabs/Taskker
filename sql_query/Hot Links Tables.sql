-- =========================================================================
-- TASKKER.IO - HOT LINKS TABLES
-- Purpose: Setup schema for Team Global Links and Private User Links
-- Run this in your Supabase SQL Editor.
-- =========================================================================

-- 1. Create global_links table (Team-Wide)
CREATE TABLE IF NOT EXISTS global_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for global_links
ALTER TABLE global_links ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read global links
CREATE POLICY "Allow authenticated read access on global_links" 
    ON global_links FOR SELECT 
    TO authenticated 
    USING (true);

-- Allow authenticated users to insert/update/delete global links 
-- (Frontend UI gatekeeps this to Admin/SuperAdmin only)
CREATE POLICY "Allow authenticated write access on global_links"
    ON global_links FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);


-- 2. Create user_links table (Personal/Private)
CREATE TABLE IF NOT EXISTS user_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for user_links
ALTER TABLE user_links ENABLE ROW LEVEL SECURITY;

-- Allow users to fully manage ONLY their own links
CREATE POLICY "Users can manage their own links" 
    ON user_links 
    FOR ALL 
    TO authenticated 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
