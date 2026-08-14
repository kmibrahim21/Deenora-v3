import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: sysData } = await supabase.from('system_settings').select('voice_rate').single();
  const targetRate = sysData?.voice_rate || 0.45;
  
  const { error } = await supabase.from('institutions').update({ voice_rate: targetRate }).eq('voice_rate', 0.5);
  console.log('Update result:', error ? error : 'Success!');
}
run();
