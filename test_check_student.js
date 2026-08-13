const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = '.env';
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf8');
} catch(e) {}

let url = '', key = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
}

const supabase = createClient(url, key);

async function check() {
  const { data: student } = await supabase.from('students').select('*').ilike('id', '%60f6cc%');
  console.log('Student:', student);
  
  if (student && student.length > 0) {
    const sId = student[0].id;
    const { data: fees } = await supabase.from('fees').select('*').eq('student_id', sId);
    console.log('Fees:', fees);
    
    const { data: settings } = await supabase.from('student_fee_settings').select('*').eq('student_id', sId);
    console.log('Settings:', settings);
  }
}
check();
