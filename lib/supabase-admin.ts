
import { createClient } from '@supabase/supabase-js';

let supabaseAdmin: any = null;

export function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://wafcgdcgqkmsngwqhded.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      console.error('SUPABASE_URL or VITE_SUPABASE_URL is missing in environment variables.');
      throw new Error('SUPABASE_URL or VITE_SUPABASE_URL is required for server-side operations.');
    }

    if (!supabaseServiceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.');
      // If service role key is missing, we might want to log it specifically
      // but still throw as it's required for admin operations.
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server-side operations. Please set it in the Vercel environment variables.');
    }

    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabaseAdmin;
}
