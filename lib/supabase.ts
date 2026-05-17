
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
 * Safe WebSocket wrapper to prevent app crashes on iOS/Safari strict environments
 * where `new WebSocket()` throws DOMException: The operation is insecure.
 */
class SafeWebSocket {
  private ws: any = null;
  public CONNECTING = 0;
  public OPEN = 1;
  public CLOSING = 2;
  public CLOSED = 3;

  constructor(url: string, protocols?: string | string[]) {
    try {
      this.ws = new window.WebSocket(url, protocols);
    } catch (e: any) {
      console.warn("WebSocket creation failed securely:", e);
      // Mock enough so Supabase realtime doesn't completely crash the runtime.
      this.ws = {
        CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3,
        readyState: 3,
        send: () => {},
        close: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      };
      
      // Simulate close event asynchronously so realtime library stops waiting
      setTimeout(() => {
        if (this.ws.onclose) this.ws.onclose({ code: 1006, reason: 'SafeWebSocket Fallback', wasClean: false });
      }, 100);
    }

    // Proxy the properties and methods
    return new Proxy(this, {
      get: (target, prop) => {
        if (typeof target.ws[prop] === 'function') {
          return target.ws[prop].bind(target.ws);
        }
        return target.ws[prop];
      },
      set: (target, prop, value) => {
        target.ws[prop] = value;
        return true;
      }
    });
  }
}

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
  },
  realtime: {
    transport: SafeWebSocket as any
  }
});
