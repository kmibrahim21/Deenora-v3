
import { supabase } from 'lib/supabase';
import { offlineDb, type CachedResponse } from './offlineDb';

// Centralized TTL Config
export const CACHE_TTLS = {
  SHORT: 5 * 60 * 1000,     // 5 mins
  MEDIUM: 10 * 60 * 1000,   // 10 mins
  LONG: 10 * 60 * 1000,     // 10 mins (Settings, Students, Classes - reduced from 1hr for better responsiveness)
  ETERNAL: 24 * 60 * 60 * 1000 // 24 hrs
};

class RequestManager {
  private cache: Map<string, { data: any; timestamp: number; count?: number }> = new Map();
  private pending: Map<string, Promise<any>> = new Map();
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private lastInvalidation: Map<string, number> = new Map();
  private isOnline = navigator.onLine;
  
  // Metrics for dashboard
  public metrics = {
    hits: 0,
    misses: 0,
    refetches: 0,
    throttled: 0
  };

  constructor() {
    this.init();
    window.addEventListener('online', () => { this.isOnline = true; });
    window.addEventListener('offline', () => { this.isOnline = false; });
  }

  private async init() {
    await this.loadPersistence();
  }

  private async loadPersistence() {
    try {
      const records = await offlineDb.response_cache.toArray();
      const now = Date.now();
      const ONE_DAY = 24 * 60 * 60 * 1000;
      
      records.forEach(val => {
        // Only load into memory if it's less than a day old
        if (now - val.timestamp < ONE_DAY) {
          this.cache.set(val.key, { data: val.data, timestamp: val.timestamp, count: val.count });
        }
      });
    } catch (e) {
      console.warn("Failed to load IndexedDB cache:", e);
    }
  }

  private async savePersistence(key: string, data: any, count?: number) {
    try {
      await offlineDb.response_cache.put({
        key,
        data,
        timestamp: Date.now(),
        count
      });
    } catch (e) {
      console.warn("Failed to save IndexedDB cache:", e);
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
    
    // Pattern-based notification for partial matches
    this.listeners.forEach((callbacks, listenerKey) => {
      if (key !== listenerKey && key.includes(listenerKey)) {
        callbacks.forEach(cb => cb(data));
      }
    });
  }

  async cachedRpc(method: string, params: any = {}, ttl = CACHE_TTLS.SHORT) {
    const key = this.getCacheKey('rpc', method, params);
    
    // Check cache
    const cached = this.cache.get(key);
    const now = Date.now();
    const isStale = cached && now - cached.timestamp > ttl;

    // Handle offline
    if (!this.isOnline && cached) {
      this.metrics.hits++;
      return { data: cached.data, error: null, count: cached.count };
    }

    // Serve from cache if not stale
    if (cached && !isStale) {
      this.metrics.hits++;
      return { data: cached.data, error: null, count: cached.count };
    }

    // Serve from cache while revalidating (SWR) with COOLDOWN Protection
    if (cached && isStale) {
      const lastInval = this.lastInvalidation.get(key) || 0;
      const cooldownPeriod = 30000; // 30 seconds cooldown after invalidation to prevent storms
      
      if (now - lastInval < cooldownPeriod) {
        this.metrics.throttled++;
        return { data: cached.data, error: null, count: cached.count };
      }

      if (!this.pending.has(key)) {
        this.metrics.refetches++;
        const promise = this.revalidateRpc(key, method, params);
        this.pending.set(key, promise);
      }
      return { data: cached.data, error: null, count: cached.count };
    }

    // Check pending if no cache
    if (this.pending.has(key)) {
      return this.pending.get(key);
    }

    this.metrics.misses++;
    const promise = this.revalidateRpc(key, method, params);
    this.pending.set(key, promise);
    return promise;
  }

  private async revalidateRpc(key: string, method: string, params: any) {
    try {
      if (!this.isOnline) throw new Error('Offline');

      const { data, error, count } = await supabase.rpc(method, params);
      if (error) throw error;
      
      this.cache.set(key, { data, timestamp: Date.now(), count });
      this.pending.delete(key);
      const result = { data, error: null, count };
      this.notify(key, result);
      this.savePersistence(key, data, count);
      return result;
    } catch (error) {
      this.pending.delete(key);
      const cached = this.cache.get(key);
      if (cached) return { data: cached.data, error: null, count: cached.count };
      return { data: null, error };
    }
  }

  async cachedFetchAll(table: string, queryBuilder: (q: any) => any, cacheKey: string, ttl = CACHE_TTLS.SHORT) {
    const key = `fetch_all:${table}:${cacheKey}`;
    
    const cached = this.cache.get(key);
    const now = Date.now();
    const isStale = cached && now - cached.timestamp > ttl;

    // Handle offline
    if (!this.isOnline && cached) {
      this.metrics.hits++;
      return { data: cached.data, error: null, count: cached.count };
    }

    if (cached && !isStale) {
      this.metrics.hits++;
      return { data: cached.data, error: null, count: cached.count };
    }

    if (cached && isStale) {
      const lastInval = this.lastInvalidation.get(key) || 0;
      const cooldownPeriod = 30000; // 30s cooldown
      
      if (now - lastInval < cooldownPeriod) {
        this.metrics.throttled++;
        return { data: cached.data, error: null, count: cached.count };
      }

      if (!this.pending.has(key)) {
        this.metrics.refetches++;
        const promise = this.revalidateFetchAll(key, table, queryBuilder);
        this.pending.set(key, promise);
      }
      return { data: cached.data, error: null, count: cached.count };
    }

    // Cache Miss
    if (this.pending.has(key)) {
      return this.pending.get(key);
    }

    this.metrics.misses++;
    const promise = this.revalidateFetchAll(key, table, queryBuilder);
    this.pending.set(key, promise);
    return promise;
  }

  private async revalidateFetchAll(key: string, table: string, queryBuilder: (q: any) => any) {
    try {
      let allData: any[] = [];
      let hasMore = true;
      let offset = 0;
      const pageSize = 1000;
      let finalCount = 0;

      while (hasMore) {
        let query = supabase.from(table);
        query = queryBuilder(query);
        // Ensure we don't accidentally override range if queryBuilder sets a limit, 
        // but typically queryBuilder just sets filters. We enforce range here.
        query = query.range(offset, offset + pageSize - 1);
        
        const { data, error, count } = await query;
        if (error) throw error;
        
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          offset += pageSize;
          if (count) finalCount = count;
          if (data.length < pageSize) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }

      this.pending.delete(key);
      const result = { data: allData, error: null, count: finalCount };
      this.notify(key, result);
      this.savePersistence(key, allData, finalCount);
      return result;
    } catch (error) {
      this.pending.delete(key);
      const cached = this.cache.get(key);
      if (cached) return { data: cached.data, error: null, count: cached.count };
      return { data: null, error };
    }
  }

  async cachedFetch(table: string, queryBuilder: (q: any) => any, cacheKey: string, ttl = CACHE_TTLS.SHORT) {
    const key = `fetch:${table}:${cacheKey}`;
    
    const cached = this.cache.get(key);
    const now = Date.now();
    const isStale = cached && now - cached.timestamp > ttl;

    // Handle offline
    if (!this.isOnline && cached) {
      this.metrics.hits++;
      return { data: cached.data, error: null, count: cached.count };
    }

    if (cached && !isStale) {
      this.metrics.hits++;
      return { data: cached.data, error: null, count: cached.count };
    }

    if (cached && isStale) {
      const lastInval = this.lastInvalidation.get(key) || 0;
      const cooldownPeriod = 30000; // 30s cooldown
      
      if (now - lastInval < cooldownPeriod) {
        this.metrics.throttled++;
        return { data: cached.data, error: null, count: cached.count };
      }

      if (!this.pending.has(key)) {
        this.metrics.refetches++;
        const promise = this.revalidateFetch(key, table, queryBuilder);
        this.pending.set(key, promise);
      }
      return { data: cached.data, error: null, count: cached.count };
    }

    if (this.pending.has(key)) {
      return this.pending.get(key);
    }

    this.metrics.misses++;
    const promise = this.revalidateFetch(key, table, queryBuilder);
    this.pending.set(key, promise);
    return promise;
  }

  private async revalidateFetch(key: string, table: string, queryBuilder: (q: any) => any) {
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request Timeout')), 15000)
    );

    try {
      if (!this.isOnline) throw new Error('Offline');

      const builder = supabase.from(table);
      const result = await Promise.race([
        Promise.resolve(queryBuilder(builder)),
        timeout
      ]) as any;
      
      const data = result.data;
      const error = result.error;
      const count = typeof result.count === 'number' ? result.count : (Array.isArray(data) ? data.length : 0);
      
      if (error) throw error;
      
      this.cache.set(key, { data, timestamp: Date.now(), count });
      this.pending.delete(key);
      const output = { data, error: null, count };
      this.notify(key, output);
      this.savePersistence(key, data, count);
      return output;
    } catch (error) {
      this.pending.delete(key);
      console.warn(`[RequestManager] Fetch failed for ${key} in table ${table}:`, error);
      const cached = this.cache.get(key);
      if (cached) return { data: cached.data, error: null, count: cached.count };
      return { data: null, error: error as any, count: 0 };
    }
  }

  async invalidate(keyPrefix?: string) {
    const now = Date.now();
    if (!keyPrefix) {
      this.cache.clear();
      this.pending.clear();
      await offlineDb.response_cache.clear();
    } else {
      const keysToDelete: string[] = [];
      for (const key of this.cache.keys()) {
        if (key.startsWith(keyPrefix)) {
          this.cache.delete(key);
          this.lastInvalidation.set(key, now); // Mark as invalidated to trigger cooldown
          keysToDelete.push(key);
        }
      }
      // Also clear pending matches
      for (const key of this.pending.keys()) {
        if (key.startsWith(keyPrefix)) {
          this.pending.delete(key);
        }
      }
      if (keysToDelete.length > 0) {
        await offlineDb.response_cache.bulkDelete(keysToDelete);
      }
    }
  }

  setManualCache(key: string, data: any, count?: number) {
    this.cache.set(key, { data, timestamp: Date.now(), count: count ?? (Array.isArray(data) ? data.length : 1) });
    this.savePersistence(key, data, count);
    this.notify(key, { data, error: null, count });
  }

  async invalidatePattern(pattern: string | RegExp) {
    const now = Date.now();
    
    // First, clear from memory cache
    for (const key of this.cache.keys()) {
      if (typeof pattern === 'string') {
        if (key.includes(pattern)) {
          this.cache.delete(key);
          this.lastInvalidation.set(key, now);
        }
      } else if (pattern.test(key)) {
        this.cache.delete(key);
        this.lastInvalidation.set(key, now);
      }
    }
    // Also clear pending matches
    for (const key of this.pending.keys()) {
      if (typeof pattern === 'string') {
        if (key.includes(pattern)) this.pending.delete(key);
      } else if (pattern.test(key)) {
        this.pending.delete(key);
      }
    }
    
    // Crucially, we must scan the indexedDB directly to find keys to delete,
    // because memory cache may be empty after a fresh load.
    try {
      const records = await offlineDb.response_cache.toArray();
      const keysToDelete = records
        .filter(record => typeof pattern === 'string' ? record.key.includes(pattern) : pattern.test(record.key))
        .map(record => record.key);

      if (keysToDelete.length > 0) {
        await offlineDb.response_cache.bulkDelete(keysToDelete);
      }
    } catch (e) {
      console.warn("Failed to delete from response_cache:", e);
    }
  }
}

export const requestManager = new RequestManager();
