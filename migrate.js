import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = `
    DROP POLICY IF EXISTS "Institutions can update their own messages" ON public.messages;
    CREATE POLICY "Institutions can update their own messages" ON public.messages
    FOR UPDATE
    USING (institution_id = auth.uid())
    WITH CHECK (institution_id = auth.uid());
  `;
  
  console.log('Trying run_sql with { sql }...');
  const { error: err1 } = await supabaseAdmin.rpc('run_sql', { sql: sql });
  if (!err1) {
    console.log('Migration successful with run_sql');
    return;
  }
  console.log('run_sql failed:', err1.message || err1);

  console.log('Trying execute_sql with { query }...');
  const { error: err2 } = await supabaseAdmin.rpc('execute_sql', { query: sql });
  if (!err2) {
    console.log('Migration successful with execute_sql');
    return;
  }
  console.log('execute_sql failed:', err2.message || err2);

  console.log('Trying exec_sql with { sql }...');
  const { error: err3 } = await supabaseAdmin.rpc('exec_sql', { sql: sql });
  if (!err3) {
    console.log('Migration successful with exec_sql');
    return;
  }
  console.log('exec_sql failed:', err3.message || err3);
}

run();
