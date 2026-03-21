-- Add the email column to the team_members table
ALTER TABLE public.team_members
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add the assignee tracking columns to the tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assignee_email TEXT;