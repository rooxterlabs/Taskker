-- ==========================================
-- PHASE 7: GLOBAL THEMING ARCHITECTURE
-- Run this block to add the `theme` metadata column to the `profiles` table.
-- ==========================================

-- 1. Add the Theme column (Safe check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'theme'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN theme TEXT DEFAULT 'dark';
  END IF;
END $$;
