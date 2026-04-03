import { supabase } from 'lib/supabase';
import { OfflineQueue } from './offlineQueue';

export class SupabaseWrapper {
  static async safeInsert(table: string, payload: any) {
    if (!navigator.onLine) {
      console.log(`[SupabaseWrapper] Offline: Queueing INSERT for ${table}`);
      return await OfflineQueue.enqueue(table, 'INSERT', payload);
    }

    const { data, error } = await supabase.from(table).insert([payload]).select();
    if (error) {
      console.error(`[SupabaseWrapper] Error inserting into ${table}`, error);
      throw error;
    }
    return data;
  }

  static async safeUpdate(table: string, id: string | number, payload: any) {
    if (!navigator.onLine) {
      console.log(`[SupabaseWrapper] Offline: Queueing UPDATE for ${table}`);
      return await OfflineQueue.enqueue(table, 'UPDATE', { ...payload, id });
    }

    const { data, error } = await supabase.from(table).update(payload).eq('id', id).select();
    if (error) {
      console.error(`[SupabaseWrapper] Error updating ${table}`, error);
      throw error;
    }
    return data;
  }

  static async safeDelete(table: string, id: string | number) {
    if (!navigator.onLine) {
      console.log(`[SupabaseWrapper] Offline: Queueing DELETE for ${table}`);
      return await OfflineQueue.enqueue(table, 'DELETE', { id });
    }

    const { data, error } = await supabase.from(table).delete().eq('id', id).select();
    if (error) {
      console.error(`[SupabaseWrapper] Error deleting from ${table}`, error);
      throw error;
    }
    return data;
  }
}
