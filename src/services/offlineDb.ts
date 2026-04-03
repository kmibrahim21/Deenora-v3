import Dexie, { type Table } from 'dexie';

export interface OfflineAction {
  id?: number;
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  clientId: string;
  timestamp: number;
  synced: 0 | 1;
  error?: string;
}

export class OfflineDatabase extends Dexie {
  actions!: Table<OfflineAction>;

  constructor() {
    super('OfflineQueueDB');
    this.version(1).stores({
      actions: '++id, table, action, clientId, timestamp, synced'
    });
  }
}

export const offlineDb = new OfflineDatabase();
