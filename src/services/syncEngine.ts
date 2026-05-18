import { supabase } from 'lib/supabase';
import { OfflineQueue } from './offlineQueue';
import { requestManager } from './RequestManager';

export class SyncEngine {
  private static isSyncing = false;
  private static syncInterval: NodeJS.Timeout | null = null;
  private static lastCleanup = 0;
  private static failureCount = 0;
  private static CIRCUIT_BREAKER_THRESHOLD = 5;
  private static MAX_CONCURRENT_BATCHES = 3;
  private static BATCH_SIZE = 50;

  static async start() {
    if (this.syncInterval) return;
    
    // Initial sync with small delay
    setTimeout(() => this.sync(), 2000);

    // Adaptive periodic sync
    this.setupAdaptiveSync();

    window.addEventListener('online', () => {
      console.log('[SyncEngine] Network online, resuming sync');
      this.failureCount = 0; 
      this.sync();
    });
  }

  private static setupAdaptiveSync() {
    const interval = this.failureCount > 0 ? Math.min(300000, 60000 * Math.pow(2, this.failureCount)) : 30000;
    
    if (this.syncInterval) clearInterval(this.syncInterval);
    
    this.syncInterval = setInterval(async () => {
      if (navigator.onLine && this.failureCount < this.CIRCUIT_BREAKER_THRESHOLD) {
        await this.sync();
      }
    }, interval);
  }

  static async sync() {
    if (this.isSyncing || !navigator.onLine) return;
    this.isSyncing = true;

    try {
      const allPending = await OfflineQueue.getPendingActions();
      
      // Filter by backoff
      const now = Date.now();
      const pending = allPending.filter(action => {
        if (!action.last_attempt) return true;
        const delay = Math.min(3600000, 5000 * Math.pow(2, action.retry_count));
        return now - action.last_attempt > delay;
      });

      if (pending.length === 0) {
        this.isSyncing = false;
        return;
      }

      console.log(`[SyncEngine] Processing ${pending.length} of ${allPending.length} pending actions`);

      // 1. Group actions by table and type for batching
      const groups: Record<string, { inserts: any[], updates: any[], deletes: any[] }> = {};
      
      pending.forEach(action => {
        if (!groups[action.table]) {
          groups[action.table] = { inserts: [], updates: [], deletes: [] };
        }
        if (action.action === 'INSERT' || action.action === 'UPSERT') {
          groups[action.table].inserts.push(action);
        } else if (action.action === 'UPDATE') {
          groups[action.table].updates.push(action);
        } else if (action.action === 'DELETE') {
          groups[action.table].deletes.push(action);
        }
      });

      // 2. Process groups
      for (const table in groups) {
        const { inserts, updates, deletes } = groups[table];

        // Batch Inserts (Most effective IO reduction)
        if (inserts.length > 0) {
          await this.processBatch(table, 'UPSERT', inserts);
        }

        // Updates (Harder to batch in one call unless using upsert with IDs)
        for (const action of updates) {
          await this.processSingleAction(action);
        }

        // Deletes
        for (const action of deletes) {
          await this.processSingleAction(action);
        }
      }

      // Cleanup
      if (now - this.lastCleanup > 600000) {
        await OfflineQueue.cleanupSynced();
        this.lastCleanup = now;
      }
      
      this.failureCount = 0; // Reset on successful pass
    } catch (err) {
      console.error('[SyncEngine] Sync cycle error', err);
      this.failureCount++;
      this.setupAdaptiveSync();
    } finally {
      this.isSyncing = false;
    }
  }

  private static async processBatch(table: string, type: 'UPSERT', actions: any[]) {
    // Process in chunks of BATCH_SIZE
    for (let i = 0; i < actions.length; i += this.BATCH_SIZE) {
      const chunk = actions.slice(i, i + this.BATCH_SIZE);
      const payloads = chunk.map(a => a.payload);

      try {
        const { error } = await supabase.from(table).upsert(payloads, { onConflict: 'id' });
        
        if (error) throw error;

        // Mark all as synced
        for (const action of chunk) {
          await OfflineQueue.markAsSynced(action.id!);
          this.invalidateRelevantCache(action);
        }
      } catch (err) {
        console.error(`[SyncEngine] Batch fail for ${table}`, err);
        for (const action of chunk) {
          await OfflineQueue.markAsFailed(action.id!, String(err));
        }
      }
    }
  }

  private static async processSingleAction(action: any) {
    try {
      const success = await this.executeAction(action);
      if (success) {
        await OfflineQueue.markAsSynced(action.id!);
        this.invalidateRelevantCache(action);
      }
    } catch (err) {
      console.error(`[SyncEngine] Action fail ${action.id}`, err);
      await OfflineQueue.markAsFailed(action.id!, String(err));
    }
  }

  private static async executeAction(action: any): Promise<boolean> {
    const { table, action: type, payload } = action;

    let query;
    if (type === 'INSERT' || type === 'UPSERT') {
      query = supabase.from(table).upsert([payload]);
    } else if (type === 'UPDATE') {
      const { id, ...updateData } = payload;
      query = supabase.from(table).update({ ...updateData, updated_at: new Date().toISOString() }).eq('id', id);
    } else if (type === 'DELETE') {
      query = supabase.from(table).delete().eq('id', payload.id);
    }

    if (query) {
      const { error } = await query;
      if (error) {
        if (error.code === '23505') return true; // Unique violation, consider synced
        throw error;
      }
      return true;
    }
    return false;
  }

  private static invalidateRelevantCache(action: any) {
    const { table, payload } = action;
    requestManager.invalidatePattern(`fetch:${table}:`);
    
    if (['fees', 'ledger', 'transactions', 'attendance'].includes(table)) {
      requestManager.invalidatePattern('stats:');
      requestManager.invalidatePattern('dashboard_');
      if (payload.student_id) {
        requestManager.invalidatePattern(`student-${payload.student_id}`);
      }
    }
  }

  // Monitoring stats
  static async getStats() {
    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), 10000));
      const all = await Promise.race([OfflineQueue.getPendingActions(), timeout]) as any[];
      return {
        pending: all.length,
        isSyncing: this.isSyncing,
        failureCount: this.failureCount,
        isCircuitOpen: this.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD
      };
    } catch (err) {
      return {
        pending: 0,
        isSyncing: false,
        failureCount: 0,
        isCircuitOpen: false,
        error: "Stats unavailable"
      };
    }
  }
}
