import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
async function run() {
  const { data, error } = await supabase.from('teachers').select('id, teacher_name, permissions, password_hash').limit(2);
  console.log(JSON.stringify(data, null, 2));
}
run();
