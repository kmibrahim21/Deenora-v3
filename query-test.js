import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase.from('fcm_tokens').select('*').limit(1);
  console.log('fcm_tokens:', error ? error.message : 'exists');
  const { data: d2, error: e2 } = await supabase.from('profiles').select('*').limit(1);
  if (d2) console.log('profiles keys:', Object.keys(d2[0]));
  const { data: d3, error: e3 } = await supabase.from('students').select('*').limit(1);
  if (d3) console.log('students keys:', Object.keys(d3[0]));
}
test();
