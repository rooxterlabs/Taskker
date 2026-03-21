-- 1. Create a DELETE policy so Super Admins can terminate accounts
CREATE POLICY "Super admins can delete profiles" ON public.profiles FOR DELETE USING (get_user_role() = 'super_admin');
