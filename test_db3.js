import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.rpc('get_schema');
  console.log(error);
  
  // try inserting a dummy just to get the columns from a generic select
  const { data: d2, error: e2 } = await supabase.from('departments').select('*').limit(1);
  console.log(d2, e2);
}
test();
