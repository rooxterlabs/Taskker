-- Fix Profile Updates for Users
-- This allows any logged in user to update the metadata of their OWN profile row.
-- Without this, the previous RBAC schema restricted all profile updates strictly to Super Admins.

CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
