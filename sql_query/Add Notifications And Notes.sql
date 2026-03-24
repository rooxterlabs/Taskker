-- Add Notification and Notes columns to Tasks Table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS is_notified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notes TEXT;
