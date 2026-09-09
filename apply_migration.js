import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const dbUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.log('No DATABASE_URL found. Please make sure it is in .env');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function apply() {
  await client.connect();
  const sql = fs.readFileSync('supabase/migrations/20260909000000_pdf_cache.sql', 'utf8');
  await client.query(sql);
  console.log('Migration applied!');
  await client.end();
}
apply().catch(console.error);
