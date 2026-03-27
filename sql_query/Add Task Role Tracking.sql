-- Migration: Add role tracking to tasks for Personal Task logic
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_by_role TEXT DEFAULT 'admin';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_role TEXT DEFAULT 'worker';

