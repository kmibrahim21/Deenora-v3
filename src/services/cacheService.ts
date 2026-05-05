import { offlineDb, type CachedData } from './offlineDb';

export class CacheService {
  static async cacheData(storeName: 'students' | 'teachers' | 'attendance' | 'fees' | 'stats', institutionId: string, data: any[] | any) {
    try {
      const table = offlineDb[storeName];
      
      // Delete existing records for this institution
      await table.where('institution_id').equals(institutionId).delete();

      // Add new records
      const dataArray = Array.isArray(data) ? data : [data];
      const cachedData: CachedData[] = dataArray.map(item => ({
        id: item.id || (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36)),
        institution_id: institutionId,
        data: item,
        timestamp: Date.now()
      }));

      await table.bulkAdd(cachedData);
    } catch (error) {
      console.error(`[CacheService] Error caching data in ${storeName}:`, error);
    }
  }

  static async getCachedData(storeName: 'students' | 'teachers' | 'attendance' | 'fees' | 'stats', institutionId: string): Promise<any[]> {
    try {
      const table = offlineDb[storeName];
      const records = await table.where('institution_id').equals(institutionId).toArray();
      return records.map(record => record.data);
    } catch (error) {
      console.error(`[CacheService] Error getting cached data from ${storeName}:`, error);
      return [];
    }
  }
}
