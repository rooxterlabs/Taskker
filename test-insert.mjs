import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pzvtihfzvceatyzosmrm.supabase.co';
const supabaseKey = 'sb_publishable_w4PyQOGiU2lcJhtwysrcMA_BpnLMpIP';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const newTask = {
    id: crypto.randomUUID(),
    status: 'To Do',
    action: 'Test action',
    category: 'General',
    due_by_type: 'This Week',
    priority: 'P2',
    target_deadline: new Date().toISOString(),
    submitted_on: new Date().toISOString(),
    assignee: 'Test',
    assignee_id: null,
    assignee_email: null,
    is_archived: false,
    created_by_role: 'worker'
  };

  console.log("Testing with created_by_role...");
  let { data, error } = await supabase.from('tasks').insert([newTask]).select();
  console.log('Error 1:', error);

  delete newTask.created_by_role;
  console.log("Testing without created_by_role...");
  let { data: d2, error: e2 } = await supabase.from('tasks').insert([newTask]).select();
  console.log('Error 2:', e2);
}
test();
