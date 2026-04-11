
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wafcgdcgqkmsngwqhded.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZmNnZGNncWttc25nd3FoZGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjU4ODEsImV4cCI6MjA5MDY0MTg4MX0.KEBjfOmIF5KbEelK--l-r3paOTpBFqlxX8pr4FgtqhY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data, error } = await supabase.from('subscription_packages').select('*').limit(1);
  if (error) {
    console.error('Error fetching subscription_packages:', error);
  } else {
    console.log('Successfully fetched subscription_packages:', data);
    if (data && data.length > 0) {
      console.log('Columns in subscription_packages:', Object.keys(data[0]));
    }
  }
}

check();
