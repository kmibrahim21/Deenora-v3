import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function check() {
  let { error } = await supabase.from('teachers').insert([{ name: 'test', phone: 'test' }]);
  console.log('With name/phone:', error);
  
  let { error: error2 } = await supabase.from('teachers').insert([{ teacher_name: 'test', mobile: 'test' }]);
  console.log('With teacher_name/mobile:', error2);
}
check();
