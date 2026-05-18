import { v4 as uuidv4 } from 'uuid';
import { offlineDb, type OfflineAction } from './offlineDb';

export class OfflineQueue {
  static async enqueue(table: string, action: 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT', payload: any, priority = 1, groupId?: string) {
    const clientId = uuidv4();
    const timestamp = Date.now();

    // 1. Intelligent Deduplication/Squashing
    // If we have a pending UPDATE for the same ID, and this is another UPDATE, squash them.
    if (action === 'UPDATE' && payload.id) {
      const existing = await offlineDb.actions
        .where({ table, action: 'UPDATE', synced: 0 })
        .filter(a => a.payload.id === payload.id)
        .first();

      if (existing) {
        console.log(`[OfflineQueue] Squashing UPDATE for ${table}:${payload.id}`);
        await offlineDb.actions.update(existing.id!, {
          payload: { ...existing.payload, ...payload },
          timestamp: Date.now(),
          priority: Math.max(existing.priority, priority)
        });
        return existing.clientId;
      }
    }

    const offlineAction: OfflineAction = {
      table,
      action,
      payload,
      clientId,
      timestamp,
      synced: 0,
      retry_count: 0,
      priority,
      group_id: groupId
    };

    await offlineDb.actions.add(offlineAction);
    console.log(`[OfflineQueue] Enqueued ${action} for ${table}`, { clientId, priority });
    return clientId;
  }

  static async getPendingActions() {
    return await offlineDb.actions
      .where('synced')
      .equals(0)
      .sortBy('priority') // Higher priority first
      .then(actions => actions.reverse()); // sortBy is ascending? check sortBy logic. Wait, reverse because sortBy() is actually low -> high.
  }

  static async markAsSynced(id: number) {
    await offlineDb.actions.update(id, { synced: 1, error: undefined });
  }

  static async markAsFailed(id: number, error: string) {
    const action = await offlineDb.actions.get(id);
    if (!action) return;
    
    await offlineDb.actions.update(id, { 
      error, 
      retry_count: (action.retry_count || 0) + 1,
      last_attempt: Date.now()
    });
  }

  static async cleanupSynced() {
    // Keep last 100 synced actions for history/audit, delete everything older
    const count = await offlineDb.actions.where('synced').equals(1).count();
    if (count > 100) {
      const toDelete = await offlineDb.actions
        .where('synced')
        .equals(1)
        .sortBy('timestamp');
      const deleteIds = toDelete.slice(0, count - 100).map(a => a.id!);
      await offlineDb.actions.bulkDelete(deleteIds);
    }
  }
}
