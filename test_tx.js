const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envs = fs.readFileSync('.env.example', 'utf-8').split('\n');
let SUPABASE_URL = '', SUPABASE_ANON_KEY = '';
for (let line of envs) {
  if (line.startsWith('VITE_SUPABASE_URL=')) SUPABASE_URL = line.split('=')[1];
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) SUPABASE_ANON_KEY = line.split('=')[1];
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const { data } = await supabase.from('transactions')
    .select('id, module, description')
    .neq('status', 'pending')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false });
    
  console.log('Total fetched:', data.length);
  const sms = data.filter(d => d.module === 'sms').length;
  const voice = data.filter(d => d.module === 'voice').length;
  const sub = data.filter(d => d.module === 'subscription').length;
  console.log(`SMS: ${sms}, Voice: ${voice}, Sub: ${sub}`);
}
test();
