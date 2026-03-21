-- 1. Drop the existing SELECT policy
DROP POLICY IF EXISTS "Role based view access" ON public.tasks;

-- 2. Create the fixed VIEW (SELECT) Policy
-- Workers can view tasks they created (user_id) OR tasks assigned to them (assignee_id)
CREATE POLICY "Role based view access" ON public.tasks 
FOR SELECT TO authenticated 
USING (
  get_user_role() IN ('super_admin', 'admin') 
  OR 
  user_id = auth.uid()
  OR
  assignee_id = auth.uid()
);

-- 3. Drop the existing UPDATE policy
DROP POLICY IF EXISTS "Role based update access" ON public.tasks;

-- 4. Create the fixed UPDATE Policy
-- Workers can update tasks they created (user_id) OR tasks assigned to them (assignee_id)
CREATE POLICY "Role based update access" ON public.tasks 
FOR UPDATE TO authenticated 
USING (
  get_user_role() IN ('super_admin', 'admin') 
  OR 
  user_id = auth.uid()
  OR
  assignee_id = auth.uid()
);

-- Note: DELETE policy remains unchanged. Workers should not be able to fully delete tasks assigned to them by Admins, only Admins can delete. Wait, if a worker creates their own task, can they delete it?
-- The previous delete policy didn't allow workers to delete anything:
-- "Admins only delete access".
-- We will leave it as is unless the user requests otherwise.
