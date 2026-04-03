import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://wafcgdcgqkmsngwqhded.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZmNnZGNncWttc25nd3FoZGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjU4ODEsImV4cCI6MjA5MDY0MTg4MX0.KEBjfOmIF5KbEelK--l-r3paOTpBFqlxX8pr4FgtqhY';
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
