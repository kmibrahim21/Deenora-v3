
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wafcgdcgqkmsngwqhded.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZmNnZGNncWttc25nd3FoZGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjU4ODEsImV4cCI6MjA5MDY0MTg4MX0.KEBjfOmIF5KbEelK--l-r3paOTpBFqlxX8pr4FgtqhY';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('Supabase environment variables are missing! Using fallback credentials.');
}

const finalUrl = supabaseUrl || '';
const finalKey = supabaseAnonKey || '';

console.log("Supabase Client Init:", { 
  url: finalUrl ? `${finalUrl.substring(0, 15)}...` : 'MISSING',
  hasKey: !!finalKey 
});

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
    lock: (name, acquireTimeout, fn) => {
      // By directly executing the function, we bypass the lock manager completely.
      // This eliminates the 10000ms timeout error on devices where navigator.locks is buggy.
      return fn();
    }
  }
});
