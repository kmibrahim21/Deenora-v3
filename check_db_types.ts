
import { getSupabaseAdmin } from './lib/supabase-admin.js';

async function checkColumns() {
  const supabase = getSupabaseAdmin();
  
  // Try to query a row to see the types in JS
  const { data, error } = await supabase.from('transactions').select('*').limit(1);
  if (error) {
    console.error('Error fetching transactions:', error);
  } else {
    console.log('Sample transaction:', data[0]);
  }

  // Check institutions table too
  const { data: inst, error: instErr } = await supabase.from('institutions').select('*').limit(1);
  if (instErr) {
    console.error('Error fetching institutions:', instErr);
  } else {
    console.log('Sample institution:', inst[0]);
  }
}

checkColumns();
