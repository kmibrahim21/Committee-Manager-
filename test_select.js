import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: insts } = await supabase.from('institutions').select('id, name').limit(1);
  if (!insts || insts.length === 0) {
    console.log('no institutions');
    return;
  }
  const madrasahId = insts[0].id;

  const payload = { 
    name: 'Test Dept ' + Date.now(), 
    institution_id: madrasahId,
    sort_order: 1,
  };
  
  const { data: newDept, error } = await supabase.from('departments').insert(payload).select().single();
  console.log('insert select single:', newDept, error);
}
test();
