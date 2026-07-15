
import { getSupabaseAdmin } from './lib/supabase-admin.ts';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const admin = getSupabaseAdmin();
  const sql = `ALTER TABLE students ADD COLUMN IF NOT EXISTS accounting_start_date DATE;`;
  console.log('Running:', sql);
  const { data, error } = await admin.rpc('run_sql', {
    sql: sql
  });
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success:', data);
  }
}
main();
