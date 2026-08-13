const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

let envContent = '';
try {
  envContent = fs.readFileSync('.env.example', 'utf8');
} catch(e) {}

let url = process.env.VITE_SUPABASE_URL;
let key = process.env.VITE_SUPABASE_ANON_KEY;

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
    
    const classId = student[0].class_id;
    const { data: structs } = await supabase.from('fee_structures').select('*').eq('class_id', classId);
    console.log('Structures:', structs);
  }
}
check();
