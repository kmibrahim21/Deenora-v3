import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wafcgdcgqkmsngwqhded.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZmNnZGNncWttc25nd3FoZGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjU4ODEsImV4cCI6MjA5MDY0MTg4MX0.KEBjfOmIF5KbEelK--l-r3paOTpBFqlxX8pr4FgtqhY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogin() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'ibrahimkhan269596@gmail.com',
    password: 'password' // I don't know the password
  });
  console.log('Login attempt error:', error?.message);
}
checkLogin();
