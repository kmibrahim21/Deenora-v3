import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data: sysData } = await supabase.from('system_settings').select('sms_rate, voice_rate').single();
  const voiceRate = sysData?.voice_rate || 0.45;
  const smsRate = sysData?.sms_rate || 0.35;
  
  console.log('Syncing all institutions to voice_rate:', voiceRate, 'sms_rate:', smsRate);
  
  const { error: vError } = await supabase.from('institutions').update({ voice_rate: voiceRate }).eq('voice_rate', 0.5);
  const { error: sError } = await supabase.from('institutions').update({ sms_rate: smsRate }).eq('sms_rate', 0.5);
  
  console.log('Update result voice:', vError ? vError : 'Success!');
  console.log('Update result sms:', sError ? sError : 'Success!');
}
run();
