import { supabase } from 'lib/supabase';
import { OfflineQueue } from './offlineQueue';

export class SyncEngine {
  private static isSyncing = false;
  private static syncInterval: NodeJS.Timeout | null = null;

  static async start() {
    if (this.syncInterval) return;
    
    // Initial sync
    await this.sync();

    // Periodic sync every 30 seconds
    this.syncInterval = setInterval(async () => {
      if (navigator.onLine) {
        await this.sync();
      }
    }, 30000);

    // Sync on reconnection
    window.addEventListener('online', async () => {
      console.log('[SyncEngine] Network back online, starting sync...');
      await this.sync();
    });
  }

  static async sync() {
    if (this.isSyncing || !navigator.onLine) return;
    this.isSyncing = true;

    try {
      const pending = await OfflineQueue.getPendingActions();
      if (pending.length === 0) {
        this.isSyncing = false;
        return;
      }

      console.log(`[SyncEngine] Syncing ${pending.length} actions...`);

      // Throttled batch processing
      for (const action of pending) {
        if (!navigator.onLine) break;
        
        try {
          const success = await this.processAction(action);
          if (success) {
            await OfflineQueue.markAsSynced(action.id!);
          }
        } catch (err) {
          console.error(`[SyncEngine] Failed to sync action ${action.id}`, err);
          await OfflineQueue.markAsFailed(action.id!, String(err));
        }
      }

      await OfflineQueue.cleanupSynced();
      console.log('[SyncEngine] Sync complete');
    } catch (err) {
      console.error('[SyncEngine] Sync error', err);
    } finally {
      this.isSyncing = false;
    }
  }

  private static async processAction(action: any): Promise<boolean> {
    const { table, action: type, payload } = action;

    let query;
    if (type === 'INSERT') {
      query = supabase.from(table).insert([{ ...payload, client_id: action.clientId }]);
    } else if (type === 'UPDATE') {
      const { id, ...updateData } = payload;
      query = supabase.from(table).update({ ...updateData, updated_at: new Date().toISOString() }).eq('id', id);
    } else if (type === 'DELETE') {
      query = supabase.from(table).delete().eq('id', payload.id);
    }

    if (query) {
      const { error } = await query;
      if (error) {
        // If it's a duplicate error (already synced), mark as success
        if (error.code === '23505') return true; 
        throw error;
      }
      return true;
    }

    return false;
  }
}
