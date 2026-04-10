
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wafcgdcgqkmsngwqhded.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZmNnZGNncWttc25nd3FoZGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjU4ODEsImV4cCI6MjA5MDY0MTg4MX0.KEBjfOmIF5KbEelK--l-r3paOTpBFqlxX8pr4FgtqhY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data, error } = await supabase.from('institutions').select('*').limit(1);
  if (error) {
    console.error('Error fetching institutions:', error);
  } else {
    console.log('Successfully fetched institutions:', data);
    if (data && data.length > 0) {
      console.log('Columns in institutions:', Object.keys(data[0]));
    }
  }
}

check();
