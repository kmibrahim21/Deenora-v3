import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: sysData } = await supabase.from('system_settings').select('sms_rate, voice_rate').single();
  console.log('System settings:', sysData);
  
  const { data: instData } = await supabase.from('institutions').select('id, sms_rate, voice_rate').limit(5);
  console.log('Institutions:', instData);
}
run();
