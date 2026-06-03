import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE URL or SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  const query = `
    ALTER TABLE institutions ADD COLUMN IF NOT EXISTS institute_code text;
    UPDATE institutions SET institute_code = config_json->>'institute_code' WHERE institute_code IS NULL AND config_json->>'institute_code' IS NOT NULL;
  `;
  
  const { error } = await supabase.rpc('exec_sql', { sql: query });
  if (error) {
     const { error: err2 } = await supabase.rpc('exec_sql', { query: query });
     if(err2) {
       console.log('Failed to execute SQL automatically (maybe exec_sql RPC is not installed or permission issue):', err2.message);
     } else {
       console.log('Successfully updated DB with query parameter.');
     }
  } else {
    console.log('Successfully updated DB with sql parameter.');
  }
}
runMigration();
