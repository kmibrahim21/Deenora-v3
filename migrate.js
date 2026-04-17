import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = `
    ALTER TABLE voice_broadcasts
    ADD COLUMN IF NOT EXISTS refunded_amount numeric DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_refunded boolean DEFAULT false;
  `;
  const { error } = await supabaseAdmin.rpc('exec_sql', { query: sql });
  if (error) {
    console.log('Error executing via RPC. We will try a different approach or assume columns are not needed if we rely on transactions.');
  } else {
    console.log('Migration successful.');
  }
}

run();
