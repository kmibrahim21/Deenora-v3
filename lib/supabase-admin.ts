
import { createClient } from '@supabase/supabase-js';

let supabaseAdmin: any = null;

export function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const supabaseUrl = 
      process.env.SUPABASE_URL || 
      process.env.VITE_SUPABASE_URL || 
      'https://wafcgdcgqkmsngwqhded.supabase.co';

    const supabaseKey = 
      process.env.SUPABASE_SERVICE_ROLE_KEY || 
      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      '';

    if (!supabaseUrl) {
      console.error('SUPABASE_URL is missing.');
    }

    try {
      supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
    } catch (err) {
      console.error('Error creating Supabase client in supabase-admin:', err);
    }
  }
  return supabaseAdmin;
}
