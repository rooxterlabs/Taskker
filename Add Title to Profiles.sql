-- Add Title Column to Profiles Table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "title" TEXT;
