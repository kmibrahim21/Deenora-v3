import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function test() {
  const { data, error } = await supabaseAdmin.from('ledger').select('*').in('category', ['শিক্ষক বেতন', 'Teacher Salary']).order('transaction_date', { ascending: false }).limit(5);
  console.log(data, error);
}

test();
