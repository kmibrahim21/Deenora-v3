import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  console.log('Session error:', sessionError);
  
  // Try to get the profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);
    
  console.log('Profiles:', profile);
  
  // Try to get the institution
  const { data: inst, error: instError } = await supabase
    .from('institutions')
    .select('*')
    .limit(1);
    
  console.log('Institutions:', inst);
}

checkUser();
