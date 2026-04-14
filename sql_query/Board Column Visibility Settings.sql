-- =========================================================================
-- TASKKER.IO - BOARD COLUMN VISIBILITY SETTINGS
-- Purpose: Per-user, per-board column visibility preferences.
--          "Show All Tasks" board uses `all_col_*` columns.
--          "My Tasks" board uses `my_col_*` columns.
-- Run this in your Supabase SQL Editor.
-- =========================================================================

-- Add columns for "Show All Tasks" board
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS all_col_backburner   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS all_col_p3           boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS all_col_p2           boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS all_col_p1           boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS all_col_in_progress  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS all_col_done         boolean NOT NULL DEFAULT true;

-- Add columns for "My Tasks" board
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS my_col_backburner    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS my_col_p3            boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS my_col_p2            boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS my_col_p1            boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS my_col_in_progress   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS my_col_done          boolean NOT NULL DEFAULT true;
