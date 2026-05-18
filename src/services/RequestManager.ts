
import { supabase } from 'lib/supabase';

// Simple in-memory cache to prevent redundant requests within a short timeframe
// Especially useful for dashboard components that all mount at once
class RequestManager {
  private cache: Map<string, { data: any; timestamp: number; count?: number }> = new Map();
  private pending: Map<string, Promise<any>> = new Map();
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private CACHE_TTL = 30000; // 30 seconds

  private PERSIST_KEY = 'deenora_request_cache';

  constructor() {
    this.loadPersistence();
  }

  private loadPersistence() {
    try {
      const saved = localStorage.getItem(this.PERSIST_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        const ONE_HOUR = 3600000;
        const now = Date.now();
        Object.entries(data).forEach(([key, val]: [string, any]) => {
          if (now - val.timestamp < ONE_HOUR) {
            this.cache.set(key, val);
          }
        });
      }
    } catch (e) {
      console.warn("Failed to load cache persistence:", e);
    }
  }

  private savePersistence() {
    try {
      const obj: Record<string, any> = {};
      const sortedEntries = Array.from(this.cache.entries())
        .sort((a, b) => b[1].timestamp - a[1].timestamp)
        .slice(0, 50);
      sortedEntries.forEach(([key, val]) => {
        obj[key] = val;
      });
      localStorage.setItem(this.PERSIST_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn("Failed to save cache persistence:", e);
    }
  }

  private getCacheKey(type: string, method: string, params: any) {
    return `${type}:${method}:${JSON.stringify(params)}`;
  }

  subscribe(key: string, callback: (data: any) => void) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);
    return () => {
      this.listeners.get(key)?.delete(callback);
    };
  }

  private notify(key: string, data: any) {
    this.listeners.get(key)?.forEach(cb => cb(data));
  }

  async cachedRpc(method: string, params: any = {}, ttl = 30000) {
    const key = this.getCacheKey('rpc', method, params);
    
    // Check cache
    const cached = this.cache.get(key);
    const isStale = cached && Date.now() - cached.timestamp > ttl;

    // Serve from cache if not stale
    if (cached && !isStale) {
      return { data: cached.data, error: null, count: cached.count };
    }

    // Serve from cache while revalidating (SWR)
    if (cached && isStale) {
      if (!this.pending.has(key)) {
        console.log(`[RequestManager] Serving stale RPC, revalidating: ${method}`);
        const promise = this.revalidateRpc(key, method, params);
        this.pending.set(key, promise);
      }
      return { data: cached.data, error: null, count: cached.count };
    }

    // Check pending if no cache
    if (this.pending.has(key)) {
      return this.pending.get(key);
    }

    const promise = this.revalidateRpc(key, method, params);
    this.pending.set(key, promise);
    return promise;
  }

  private async revalidateRpc(key: string, method: string, params: any) {
    try {
      const { data, error, count } = await supabase.rpc(method, params);
      if (error) throw error;
      
      this.cache.set(key, { data, timestamp: Date.now(), count });
      this.pending.delete(key);
      const result = { data, error: null, count };
      this.notify(key, result);
      this.savePersistence();
      return result;
    } catch (error) {
      this.pending.delete(key);
      return { data: null, error };
    }
  }

  async cachedFetch(table: string, queryBuilder: (q: any) => any, cacheKey: string, ttl = 30000) {
    const key = `fetch:${table}:${cacheKey}`;
    
    const cached = this.cache.get(key);
    const isStale = cached && Date.now() - cached.timestamp > ttl;

    if (cached && !isStale) {
      return { data: cached.data, error: null, count: cached.count };
    }

    if (cached && isStale) {
      if (!this.pending.has(key)) {
        console.log(`[RequestManager] Serving stale fetch, revalidating: ${table}:${cacheKey}`);
        const promise = this.revalidateFetch(key, table, queryBuilder);
        this.pending.set(key, promise);
      }
      return { data: cached.data, error: null, count: cached.count };
    }

    if (this.pending.has(key)) {
      return this.pending.get(key);
    }

    const promise = this.revalidateFetch(key, table, queryBuilder);
    this.pending.set(key, promise);
    return promise;
  }

  private async revalidateFetch(key: string, table: string, queryBuilder: (q: any) => any) {
    try {
      const builder = supabase.from(table);
      const result = await queryBuilder(builder);
      
      const data = result.data;
      const error = result.error;
      const count = result.count;
      
      if (error) throw error;
      
      this.cache.set(key, { data, timestamp: Date.now(), count });
      this.pending.delete(key);
      const output = { data, error: null, count };
      this.notify(key, output);
      this.savePersistence();
      return output;
    } catch (error) {
      this.pending.delete(key);
      return { data: null, error };
    }
  }

  invalidate(keyPrefix?: string) {
    if (!keyPrefix) {
      this.cache.clear();
    } else {
      for (const key of this.cache.keys()) {
        if (key.startsWith(keyPrefix)) {
          this.cache.delete(key);
        }
      }
    }
  }

  invalidatePattern(pattern: string | RegExp) {
    for (const key of this.cache.keys()) {
      if (typeof pattern === 'string') {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      } else if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

export const requestManager = new RequestManager();
