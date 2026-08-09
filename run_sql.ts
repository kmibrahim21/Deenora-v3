import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    const sql = process.argv[2];
    if (!sql) {
      console.error("No SQL statement provided");
      process.exit(1);
    }
    
    console.log("Running SQL:", sql);
    const { data, error } = await supabase.rpc('run_sql', {
      sql: sql
    });

    if (error) {
      console.error("Error running SQL via RPC:", error);
      // Fallback if RPC doesn't exist - this is just a placeholder, 
      // usually we'd need a different way to run raw SQL if RPC is missing.
    } else {
      console.log("Success:", data);
    }
  } catch (e) {
    console.error(e);
  }
}

runMigration();
