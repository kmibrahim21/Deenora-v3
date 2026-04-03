import { v4 as uuidv4 } from 'uuid';
import { offlineDb, type OfflineAction } from './offlineDb';

export class OfflineQueue {
  static async enqueue(table: string, action: 'INSERT' | 'UPDATE' | 'DELETE', payload: any) {
    const clientId = uuidv4();
    const timestamp = Date.now();

    const offlineAction: OfflineAction = {
      table,
      action,
      payload,
      clientId,
      timestamp,
      synced: 0
    };

    await offlineDb.actions.add(offlineAction);
    console.log(`[OfflineQueue] Enqueued ${action} for ${table}`, { clientId });
    return clientId;
  }

  static async getPendingActions() {
    return await offlineDb.actions
      .where('synced')
      .equals(0)
      .sortBy('timestamp');
  }

  static async markAsSynced(id: number) {
    await offlineDb.actions.update(id, { synced: 1 });
  }

  static async markAsFailed(id: number, error: string) {
    await offlineDb.actions.update(id, { error });
  }

  static async cleanupSynced() {
    await offlineDb.actions.where('synced').equals(1).delete();
  }
}
