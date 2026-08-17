import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: inst } = await supabase.from('institutions').select('id, config_json').limit(1);
  if (!inst) return;
  const { error } = await supabase.from('institutions').update({ config_json: {} }).eq('id', inst[0].id);
  console.log('Update error:', error);
}
test();
