
import { createClient } from '@supabase/supabase-js';

let supabaseAdmin: any = null;

export function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://wafcgdcgqkmsngwqhded.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl) {
      console.error('SUPABASE_URL is missing.');
      throw new Error('SUPABASE_URL is required. Please set it in your environment variables.');
    }

    if (!supabaseServiceKey) {
      const envKeys = Object.keys(process.env).filter(k => k.includes('SUPABASE'));
      console.error('SUPABASE_SERVICE_ROLE_KEY is missing. Available Supabase keys:', envKeys);
      throw new Error(`SUPABASE_SERVICE_ROLE_KEY is missing. Found these Supabase-related keys: ${envKeys.join(', ') || 'None'}. Please ensure you have added the "service_role" secret key to your Vercel environment variables and REDEPLOYED.`);
    }

    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabaseAdmin;
}
