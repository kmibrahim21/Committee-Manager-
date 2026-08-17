import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'ibrahimkhan269596@gmail.com',
    password: 'password123'
  });
  if (signInError) {
    console.log('SignIn Error:', signInError.message);
    return;
  }
  
  const { data: inst } = await supabase.from('institutions').select('id').limit(1);
  if (inst && inst.length > 0) {
    const { error } = await supabase.from('institutions').update({ name: 'Test' }).eq('id', inst[0].id);
    console.log('Update result:', error);
  }
}
test();
