import { getSupabaseAdmin } from './lib/supabase-admin.ts';

async function main() {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc('run_sql', {
    sql: "SELECT transaction_id, COUNT(*) FROM transactions GROUP BY transaction_id HAVING COUNT(*) > 1;"
  });
  console.log(error || data);
}
main();
