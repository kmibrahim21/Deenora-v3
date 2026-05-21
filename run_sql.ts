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
    console.log("Process Env Keys:", Object.keys(process.env).filter(key => 
      key.includes('DB') || key.includes('POSTGRES') || key.includes('DATABASE') || key.includes('SUPABASE') || key.includes('URL') || key.includes('KEY')
    ));
  } catch (e) {
    console.error(e);
  }
}

runMigration();
