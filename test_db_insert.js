import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: user } = await supabase.auth.signInWithPassword({
    email: 'ibrahimkhan269596@gmail.com',
    password: 'password' // We don't have the password, we can't do this easily. Let's just inspect the code.
  });
}
test();
