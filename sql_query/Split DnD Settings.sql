-- Split Drag & Drop Settings Migration
-- Adds separate mobile and desktop D&D toggles to user_settings.
-- Mobile defaults ON, Desktop defaults OFF.
-- Run this in your Supabase SQL Editor.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS dnd_mobile_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS dnd_desktop_enabled boolean NOT NULL DEFAULT false;

-- Update existing rows so mobile is ON and desktop is OFF
-- (mirrors the previous kanban_enabled behaviour for desktop and new mobile default)
UPDATE user_settings
SET
  dnd_mobile_enabled  = true,
  dnd_desktop_enabled = COALESCE(kanban_enabled, false);
