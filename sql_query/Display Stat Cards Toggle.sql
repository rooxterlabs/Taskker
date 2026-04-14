-- =========================================================================
-- TASKKER.IO - DISPLAY STAT CARDS TOGGLE
-- Purpose: Allow users to show or hide the stat cards on the dashboard.
-- Run this in your Supabase SQL Editor.
-- =========================================================================

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS display_stat_cards boolean NOT NULL DEFAULT true;
