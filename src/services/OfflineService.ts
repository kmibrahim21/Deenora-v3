import { SupabaseWrapper } from './supabaseWrapper';
import { SyncEngine } from './syncEngine';
import { OfflineQueue } from './offlineQueue';

export const OfflineService = {
  // Safe wrappers
  safeInsert: SupabaseWrapper.safeInsert,
  safeUpdate: SupabaseWrapper.safeUpdate,
  safeDelete: SupabaseWrapper.safeDelete,

  // Sync control
  startSyncEngine: () => SyncEngine.start(),
  syncNow: () => SyncEngine.sync(),
  processQueue: () => SyncEngine.sync(),

  // Queue info
  getPendingCount: async () => {
    const pending = await OfflineQueue.getPendingActions();
    return pending.length;
  },

  // Backward compatibility methods
  queueAction: (table: string, action: 'INSERT' | 'UPDATE' | 'DELETE', payload: any) => 
    OfflineQueue.enqueue(table, action, payload),

  getCache: (key: string) => {
    try {
      const data = localStorage.getItem(`cache_${key}`);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.warn("Storage warning:", e);
      return null;
    }
  },

  setCache: (key: string, data: any) => {
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify(data));
    } catch (e) {
      console.warn("Storage warning:", e);
    }
  },

  removeCache: (key: string) => {
    try {
      localStorage.removeItem(`cache_${key}`);
    } catch (e) {}
  }
};
