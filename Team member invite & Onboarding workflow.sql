-- 1. Update team_members to handle the "Invite" workflow
ALTER TABLE public.team_members 
ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'invited';

-- 2. DROP the auto-user_id trigger for team members ONLY. 
-- If we don't do this, the Admin's ID will accidentally get assigned to the new invitee!
DROP TRIGGER IF EXISTS set_team_members_user_id ON public.team_members;

-- 3. Ensure RLS (Row Level Security) allows Admins to create these placeholders
-- FIX: We are now using your existing get_user_role() function!
CREATE POLICY "Admins can create team members" 
ON public.team_members 
FOR INSERT 
TO authenticated 
WITH CHECK (
  get_user_role() IN ('admin', 'super_admin')
);

-- 4. Create a Function to "Claim" the profile during Onboarding
-- FIX: Changed new_preferred_name to new_name to perfectly match your schema
CREATE OR REPLACE FUNCTION public.handle_member_onboarding(
    target_email TEXT,
    new_name TEXT,
    new_user_id UUID
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.team_members
    SET 
        user_id = new_user_id,
        name = new_name,
        status = 'active'
    WHERE email = target_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;