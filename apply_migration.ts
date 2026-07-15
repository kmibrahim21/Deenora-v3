
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
);

async function migrate() {
  const sql = `ALTER TABLE students ADD COLUMN IF NOT EXISTS accounting_start_date DATE;`;
  
  console.log('Running migration...');
  
  // Try different RPC names
  const rpcs = ['run_sql', 'execute_sql', 'exec_sql'];
  for (const rpc of rpcs) {
    console.log(`Trying RPC: ${rpc}`);
    const { error } = await supabase.rpc(rpc, { sql: sql, query: sql });
    if (!error) {
      console.log(`Success with RPC: ${rpc}`);
      return;
    }
    console.log(`Failed with RPC: ${rpc}`, error.message);
  }
}

migrate();
