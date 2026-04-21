import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('messages').select('*').limit(1);
  if (error && error.code === '42P01') {
    console.log("TABLE_MISSING");
  } else if (error) {
    console.log("ERROR", error);
  } else {
    console.log("TABLE_EXISTS");
  }
}
check();
