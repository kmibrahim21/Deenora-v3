import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('teachers').insert({
    institution_id: '00000000-0000-0000-0000-000000000000',
    teacher_name: 'Test'
  }).select();
  console.log('Insert result:', data, error);
}

check();
