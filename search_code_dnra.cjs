const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function searchAll() {
  // Check institutions table with json stringify
  const { data: insts } = await supabase.from('institutions').select('*');
  console.log('--- SEARCHING INSTITUTIONS FOR DNRA0120 ---');
  insts.forEach(i => {
    const jsonStr = JSON.stringify(i);
    if (jsonStr.toLowerCase().includes('dnra0120') || jsonStr.toLowerCase().includes('dnra')) {
      console.log('MATCHED INST:', i);
    }
  });

  // Check profiles table
  const { data: profs } = await supabase.from('profiles').select('*');
  console.log('--- SEARCHING PROFILES FOR DNRA0120 ---');
  profs.forEach(p => {
    const jsonStr = JSON.stringify(p);
    if (jsonStr.toLowerCase().includes('dnra0120') || jsonStr.toLowerCase().includes('dnra')) {
      console.log('MATCHED PROFILE:', p);
    }
  });

  // Check transactions table
  const { data: txs } = await supabase.from('transactions').select('*').limit(200);
  console.log('--- SEARCHING TRANSACTIONS FOR DNRA0120 ---');
  txs.forEach(t => {
    const jsonStr = JSON.stringify(t);
    if (jsonStr.toLowerCase().includes('dnra0120') || jsonStr.toLowerCase().includes('dnra')) {
      console.log('MATCHED TX:', t);
    }
  });
}

searchAll();
