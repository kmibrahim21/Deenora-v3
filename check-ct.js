import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data } = await supabase.from('institutions').select('id, name, logo_url').not('logo_url', 'is', null).limit(20);
  for (const inst of data) {
    try {
      const res = await fetch(inst.logo_url, { method: 'HEAD' });
      console.log(`${inst.name}: ${res.headers.get('content-type')} (${res.status})`);
    } catch (e) {
      console.log(`${inst.name}: Error ${e.message}`);
    }
  }
}
run();
