import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function check() {
  const { data: d1, error: e1 } = await supabase.rpc('exec_sql', { sql: 'ALTER TABLE system_settings ADD COLUMN auto_deactivation_enabled BOOLEAN DEFAULT FALSE;' });
  console.log('alter:', e1?.message);
  
  const { error } = await supabase.from('system_settings').update({ auto_deactivation_enabled: true }).eq('id', '00000000-0000-0000-0000-000000000001');
  console.log('update:', error?.message);
}

check();
