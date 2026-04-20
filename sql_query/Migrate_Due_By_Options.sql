-- =========================================================================
-- TASKKER.IO - MIGRATE DUE BY OPTIONS
-- Purpose: Renames existing 'This Week' and 'This Month' options 
--          in the tasks table to match the new 'End of week' and 
--          'End of Month' standards.
-- Run this in your Supabase SQL Editor.
-- =========================================================================

-- Migrate 'This Week' to 'End of week'
UPDATE tasks 
SET due_by_type = 'End of week'
WHERE due_by_type = 'This Week';

-- Migrate 'This Month' to 'End of Month'
UPDATE tasks 
SET due_by_type = 'End of Month'
WHERE due_by_type = 'This Month';
