import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wafcgdcgqkmsngwqhded.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZmNnZGNncWttc25nd3FoZGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjU4ODEsImV4cCI6MjA5MDY0MTg4MX0.KEBjfOmIF5KbEelK--l-r3paOTpBFqlxX8pr4FgtqhY';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('Supabase environment variables are missing! Using fallback credentials.');
}

const finalUrl = supabaseUrl || '';
const finalKey = supabaseAnonKey || '';

/**
 * Resilient fetch wrapper with exponential backoff for transient 503 / PGRST002 ("sorry, too many clients already")
 * and temporary network hiccups. Prevents frontend crashes and blank screens during database connection spikes.
 */
const resilientClientFetch: typeof fetch = async (input, init = {}) => {
  const MAX_RETRIES = 3;
  let attempt = 0;

  while (true) {
    try {
      const response = await fetch(input, init);

      // Handle 503 (Too many clients / Service Unavailable) or 502/504 Bad Gateway/Gateway Timeout
      if (response.status === 503 || response.status === 502 || response.status === 504) {
        if (attempt < MAX_RETRIES) {
          attempt++;
          // Exponential backoff with jitter: 200ms, 500ms, 1100ms
          const backoffMs = Math.min(200 * Math.pow(2, attempt) + Math.random() * 150, 2500);
          console.warn(`[SupabaseClient] HTTP ${response.status} (Database under load), retrying in ${Math.round(backoffMs)}ms (Attempt ${attempt}/${MAX_RETRIES})...`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }
      }

      return response;
    } catch (err: any) {
      if (attempt < MAX_RETRIES && (err.name === 'TypeError' || err.message?.includes('fetch') || err.message?.includes('network') || err.message?.includes('Failed to fetch'))) {
        attempt++;
        const backoffMs = Math.min(200 * Math.pow(2, attempt) + Math.random() * 150, 2500);
        console.warn(`[SupabaseClient] Network error (${err.message}), retrying in ${Math.round(backoffMs)}ms (Attempt ${attempt}/${MAX_RETRIES})...`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
      throw err;
    }
  }
};

/**
 * Global Supabase client instance.
 * Configured with resilient retry logic, connection pooling tolerance, and persistent session for PWA.
 */
export const supabase = createClient(finalUrl, finalKey, {
  auth: {
    persistSession: typeof window !== 'undefined',
    autoRefreshToken: typeof window !== 'undefined',
    detectSessionInUrl: typeof window !== 'undefined',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'madrasah_auth_token',
    flowType: 'pkce',
    lock: <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
      return fn();
    }
  },
  global: {
    fetch: resilientClientFetch
  }
});
