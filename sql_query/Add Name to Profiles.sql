-- Add Name column to Profiles table for Display Name syncing
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name TEXT;
