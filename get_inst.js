const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await supabase.from('profiles').select('institution_id, institutions(name)').eq('email', 'ibrahimkhan269596@gmail.com');
  console.log(JSON.stringify(data, null, 2));
}
run();
