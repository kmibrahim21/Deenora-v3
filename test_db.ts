import { supabase } from './src/supabase';
async function test() {
  const { data, error } = await supabase.from('institutions').select('contact_email').limit(1);
  console.log("Data:", data);
  console.log("Error:", error);
}
test();
