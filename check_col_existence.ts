
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

async function check() {
  const { error } = await supabase.from('students').insert({
    accounting_start_date: '2024-01-01',
    student_name: 'TEST_COL_CHECK',
    guardian_phone: '123'
  });
  
  if (error) {
    console.log('Error Code:', error.code);
    console.log('Error Message:', error.message);
  } else {
    console.log('Column exists!');
  }
}

check();
