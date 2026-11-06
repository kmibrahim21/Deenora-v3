import { createClient } from '@supabase/supabase-js';

// Global singleton container to survive module reload / warm serverless re-use
const globalForSupabaseAdmin = globalThis as unknown as {
  __supabaseAdminInstance?: any;
};

/**
 * Creates or retrieves the singleton Supabase Admin client.
 * Enforces serverless connection pooling, persistent session disabled,
 * and automated retry with exponential backoff on transient 503/PGRST002 errors.
 */
export function getSupabaseAdmin(): any {
  if (globalForSupabaseAdmin.__supabaseAdminInstance) {
    return globalForSupabaseAdmin.__supabaseAdminInstance;
  }

  const supabaseUrl = 
    process.env.SUPABASE_POOLER_URL ||
    process.env.SUPABASE_URL || 
    process.env.VITE_SUPABASE_URL || 
    'https://wafcgdcgqkmsngwqhded.supabase.co';

  const supabaseKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZmNnZGNncWttc25nd3FoZGVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjU4ODEsImV4cCI6MjA5MDY0MTg4MX0.KEBjfOmIF5KbEelK--l-r3paOTpBFqlxX8pr4FgtqhY';

  if (!supabaseUrl) {
    console.error('[SupabaseAdmin] SUPABASE_URL is missing.');
  }

  // Custom fetch with keepalive & exponential backoff retry for transient 503 / PGRST002 errors
  const resilientFetch = async (input: any, init?: any) => {
    const MAX_RETRIES = 3;
    let attempt = 0;

    // Attach keep-alive header for socket reuse in serverless runtimes
    const headers = new Headers(init?.headers || {});
    if (!headers.has('Connection')) {
      headers.set('Connection', 'keep-alive');
    }

    const requestInit = {
      ...(init || {}),
      headers
    };

    while (true) {
      try {
        const response = await fetch(input, requestInit);

        // Check for connection exhaustion (503 / 502 / 504 / PGRST002)
        if (response.status === 503 || response.status === 502 || response.status === 504) {
          if (attempt < MAX_RETRIES) {
            attempt++;
            const backoffMs = Math.min(100 * Math.pow(2, attempt) + Math.random() * 100, 1500);
            console.warn(`[SupabaseAdmin] Transient ${response.status} error, retrying attempt ${attempt}/${MAX_RETRIES} in ${Math.round(backoffMs)}ms...`);
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }
        }

        return response;
      } catch (err: any) {
        if (attempt < MAX_RETRIES && (err.name === 'FetchError' || err.message?.includes('fetch') || err.message?.includes('socket') || err.message?.includes('ECONNRESET'))) {
          attempt++;
          const backoffMs = Math.min(100 * Math.pow(2, attempt) + Math.random() * 100, 1500);
          console.warn(`[SupabaseAdmin] Network error (${err.message}), retrying attempt ${attempt}/${MAX_RETRIES} in ${Math.round(backoffMs)}ms...`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }
        throw err;
      }
    }
  };

  try {
    const client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      db: {
        schema: 'public'
      },
      global: {
        fetch: resilientFetch as any
      }
    });

    globalForSupabaseAdmin.__supabaseAdminInstance = client;
    return client;
  } catch (err) {
    console.error('[SupabaseAdmin] Error creating Supabase client:', err);
    throw err;
  }
}

export const supabaseAdmin = getSupabaseAdmin();
