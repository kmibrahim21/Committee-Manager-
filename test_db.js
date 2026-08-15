import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://x.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'x';
const supabase = createClient(supabaseUrl, supabaseKey);
async function run() {
  const { data, error } = await supabase.from('members').select('*').limit(1);
  console.log("Data:", data);
  console.log("Error:", error);
}
run();
