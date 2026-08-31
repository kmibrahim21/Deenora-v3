require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data } = await supabase.from('institutions').select('name, config_json');
  const match = data.find(d => JSON.stringify(d).includes('বেতন পরিশোধ করার'));
  console.log("Name:", match?.name);
}
run();
