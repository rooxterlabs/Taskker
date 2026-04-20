-- =========================================================================
-- TASKKER.IO - DUE BY VISIBILITY SETTINGS
-- Purpose: Adds user preference columns for "Personal Tasks" Due By options.
-- Run this in your Supabase SQL Editor.
-- =========================================================================

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS pref_due_1hr         boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pref_due_6hrs        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pref_due_today       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pref_due_3days       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pref_due_7days       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pref_due_14days      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pref_due_end_of_week boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pref_due_4weeks      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pref_due_end_of_month boolean NOT NULL DEFAULT true;
