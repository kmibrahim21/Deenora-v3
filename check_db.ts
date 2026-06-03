
import { getSupabaseAdmin } from './lib/supabase-admin.js';

async function checkConstraints() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('get_tables'); // This might not exist
  
  // Try to query information_schema if possible via rpc or just a direct query if enabled
  // But usually REST API doesn't allow information_schema.
  
  const { data: inst } = await supabase.from('institutions').select('id').limit(1).single();
  if (!inst) return;
  const validId = inst.id;

  // Let's try to insert a duplicate transaction_id and see the error.
  const testId = 'TEST_DUPLICATE_ID_' + Date.now();
  await supabase.from('transactions').insert({
    institution_id: validId,
    amount: 1,
    transaction_id: testId,
    sender_phone: 'TEST',
    type: 'credit',
    status: 'approved',
    module: 'voice'
  });
  
  const { error: error2 } = await supabase.from('transactions').insert({
    institution_id: validId,
    amount: 1,
    transaction_id: testId,
    sender_phone: 'TEST',
    type: 'credit',
    status: 'approved',
    module: 'voice'
  });
  
  console.log('Duplicate insert error (is it unique?):', JSON.stringify(error2, null, 2));
}

checkConstraints();
