import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkCols() {
  const { data, error } = await supabase.rpc("execute_sql", {
    query: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'attendance';"
  });
  console.log(error || data);
}
checkCols();
