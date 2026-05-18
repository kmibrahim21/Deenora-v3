import Dexie, { type Table } from 'dexie';

export interface OfflineAction {
  id?: number;
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT';
  payload: any;
  clientId: string;
  timestamp: number;
  synced: 0 | 1;
  error?: string;
  retry_count: number;
  priority: number; // 0 low, 1 normal, 2 high
  group_id?: string; // for batching
  last_attempt?: number;
}

export interface CachedData {
  id: string;
  institution_id: string;
  data: any;
  timestamp: number;
}

export interface CachedResponse {
  key: string;
  data: any;
  timestamp: number;
  count?: number;
}

export class OfflineDatabase extends Dexie {
  actions!: Table<OfflineAction>;
  students!: Table<CachedData>;
  teachers!: Table<CachedData>;
  attendance!: Table<CachedData>;
  attendance_daily!: Table<CachedData>;
  fees!: Table<CachedData>;
  stats!: Table<CachedData>;
  response_cache!: Table<CachedResponse>;

  constructor() {
    super('OfflineQueueDB');
    this.version(6).stores({
      actions: '++id, table, action, clientId, timestamp, synced, retry_count, priority, group_id',
      students: 'id, institution_id, timestamp',
      teachers: 'id, institution_id, timestamp',
      attendance: 'id, institution_id, timestamp',
      attendance_daily: 'id, institution_id, timestamp',
      fees: 'id, institution_id, timestamp',
      stats: 'id, institution_id, timestamp',
      response_cache: 'key, timestamp'
    });
  }
}

export const offlineDb = new OfflineDatabase();
