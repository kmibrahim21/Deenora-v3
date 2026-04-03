
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase environment variables are missing! Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  console.log('Current VITE_SUPABASE_URL:', supabaseUrl);
}

const finalUrl = supabaseUrl || '';
const finalKey = supabaseAnonKey || '';

/**
 * Global Supabase client instance.
 * Persistent session enabled for PWA functionality.
 */
export const supabase = createClient(finalUrl, finalKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'madrasah_auth_token',
    flowType: 'pkce',
    lock: async (_name: string, _acquireTimeout: number, acquire: () => Promise<any>) => {
      return await acquire();
    }
  }
});
