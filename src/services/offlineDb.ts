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

export interface CachedData {
  id: string;
  institution_id: string;
  data: any;
  timestamp: number;
}

export class OfflineDatabase extends Dexie {
  actions!: Table<OfflineAction>;
  students!: Table<CachedData>;
  teachers!: Table<CachedData>;
  attendance!: Table<CachedData>;
  fees!: Table<CachedData>;

  constructor() {
    super('OfflineQueueDB');
    this.version(2).stores({
      actions: '++id, table, action, clientId, timestamp, synced',
      students: 'id, institution_id, timestamp',
      teachers: 'id, institution_id, timestamp',
      attendance: 'id, institution_id, timestamp',
      fees: 'id, institution_id, timestamp'
    });
  }
}

export const offlineDb = new OfflineDatabase();
