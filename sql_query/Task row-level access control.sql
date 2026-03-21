-- 1. Remove the old "open door" policy on tasks
DROP POLICY IF EXISTS "Enable all operations for authenticated users on tasks" ON public.tasks;

-- 2. Create the VIEW (SELECT) Policy
CREATE POLICY "Role based view access" ON public.tasks 
FOR SELECT TO authenticated 
USING (
  get_user_role() IN ('super_admin', 'admin') 
  OR 
  user_id = auth.uid()
);

-- 3. Create the INSERT Policy
-- Everyone can create a task, but the database trigger we made earlier 
-- will automatically force their auth.uid() into the user_id column.
CREATE POLICY "Everyone can insert tasks" ON public.tasks 
FOR INSERT TO authenticated 
WITH CHECK (true);

-- 4. Create the UPDATE Policy
-- Admins/Super Admins can update anything. Workers can ONLY update their own tasks.
CREATE POLICY "Role based update access" ON public.tasks 
FOR UPDATE TO authenticated 
USING (
  get_user_role() IN ('super_admin', 'admin') 
  OR 
  user_id = auth.uid()
);

-- 5. Create the DELETE Policy
-- Workers are NOT allowed to delete tasks at the database level.
CREATE POLICY "Admins only delete access" ON public.tasks 
FOR DELETE TO authenticated 
USING (
  get_user_role() IN ('super_admin', 'admin')
);