-- =========================================================================
-- TASKKER.IO - REWARDS TABLE
-- Stores reward definitions created by admins/super_admins.
-- Each row represents one reward slot (up to 10 per organization).
-- =========================================================================

-- Create the rewards table
CREATE TABLE IF NOT EXISTS public.rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 10),
  title TEXT NOT NULL DEFAULT '',
  requirement TEXT NOT NULL DEFAULT '',
  reward TEXT NOT NULL DEFAULT '',
  created_by_email TEXT,
  created_by_role TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(slot)
);

-- Enable RLS
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

-- All authenticated users can READ rewards (workers need to see their rewards)
CREATE POLICY "Authenticated users can read rewards"
  ON public.rewards FOR SELECT TO authenticated USING (true);

-- Only admins and super_admins can INSERT/UPDATE/DELETE rewards
CREATE POLICY "Admins can manage rewards"
  ON public.rewards FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin', 'admin'))
  WITH CHECK (get_user_role() IN ('super_admin', 'admin'));

-- Seed the 10 empty reward slots
INSERT INTO public.rewards (slot, title, requirement, reward)
VALUES
  (1, '', '', ''),
  (2, '', '', ''),
  (3, '', '', ''),
  (4, '', '', ''),
  (5, '', '', ''),
  (6, '', '', ''),
  (7, '', '', ''),
  (8, '', '', ''),
  (9, '', '', ''),
  (10, '', '', '')
ON CONFLICT (slot) DO NOTHING;
