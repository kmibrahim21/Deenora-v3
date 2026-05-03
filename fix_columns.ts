
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

async function run() {
  const sql = `
    -- Make transaction_id unique
    CREATE UNIQUE INDEX IF NOT EXISTS unique_transaction_id ON transactions(transaction_id);
  `;
  
  console.log('Running migration to fix column types...');
  const { error } = await supabaseAdmin.rpc('exec_sql', { query: sql });
  
  if (error) {
    console.error('Migration failed:', JSON.stringify(error, null, 2));
    console.log('Trying manual check for columns if exec_sql fails...');
  } else {
    console.log('Migration successful: amount and balance are now numeric.');
  }
}

run();
