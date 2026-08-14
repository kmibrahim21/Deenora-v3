import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('tutorials').select('*');
  if (error) {
    console.error(error);
    return;
  }
  console.log('Total tutorials:', data.length);
  const categories = [...new Set(data.map(t => t.category))];
  console.log('Categories in DB:', categories);
  data.forEach(t => {
    if (!t.title || (!t.url && !t.youtube_url)) {
      console.log('Missing data in tutorial:', t.id, t.title);
    }
  });
}
run();
