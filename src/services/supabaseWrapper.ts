import { supabase } from 'lib/supabase';
import { OfflineQueue } from './offlineQueue';

const HIGH_PRESSURE_TABLES = [
  'attendance',
  'student_attendance',
  'fees',
  'ledger',
  'transactions',
  'call_logs',
  'sms_logs',
  'accounting_updates',
  'messages',
  'library_issues',
  'notices',
  'exam_marks'
];

export class SupabaseWrapper {
  static async safeInsert(table: string, payload: any, priority = 1) {
    const isHighPressure = HIGH_PRESSURE_TABLES.includes(table);

    // If high pressure table OR offline, queue it
    if (isHighPressure || !navigator.onLine) {
      console.log(`[SupabaseWrapper] Queueing INSERT for ${table} (High Pressure: ${isHighPressure})`);
      if (Array.isArray(payload)) {
        for (const item of payload) {
           await OfflineQueue.enqueue(table, 'INSERT', item, priority);
        }
        return payload;
      }
      return await OfflineQueue.enqueue(table, 'INSERT', payload, priority);
    }

    const { data, error } = await supabase.from(table).insert(Array.isArray(payload) ? payload : [payload]).select();
    if (error) {
      console.error(`[SupabaseWrapper] Error inserting into ${table}`, error);
      throw error;
    }
    return data;
  }

  static async safeUpdate(table: string, id: string | number, payload: any, priority = 1) {
    const isHighPressure = HIGH_PRESSURE_TABLES.includes(table);

    if (isHighPressure || !navigator.onLine) {
      console.log(`[SupabaseWrapper] Queueing UPDATE for ${table} (High Pressure: ${isHighPressure})`);
      return await OfflineQueue.enqueue(table, 'UPDATE', { ...payload, id }, priority);
    }

    const { data, error } = await supabase.from(table).update(payload).eq('id', id).select();
    if (error) {
      console.error(`[SupabaseWrapper] Error updating ${table}`, error);
      throw error;
    }
    return data?.[0];
  }

  static async safeDelete(table: string, id: string | number, priority = 2) {
    const isHighPressure = HIGH_PRESSURE_TABLES.includes(table);

    if (isHighPressure || !navigator.onLine) {
      console.log(`[SupabaseWrapper] Queueing DELETE for ${table} (High Pressure: ${isHighPressure})`);
      return await OfflineQueue.enqueue(table, 'DELETE', { id }, priority);
    }

    const { data, error } = await supabase.from(table).delete().eq('id', id).select();
    if (error) {
      console.error(`[SupabaseWrapper] Error deleting from ${table}`, error);
      throw error;
    }
    return data?.[0];
  }

  static async safeUpsert(table: string, payload: any, priority = 1) {
    const isHighPressure = HIGH_PRESSURE_TABLES.includes(table);
    if (isHighPressure || !navigator.onLine) {
      console.log(`[SupabaseWrapper] Queueing UPSERT for ${table} (High Pressure: ${isHighPressure})`);
      if (Array.isArray(payload)) {
        for (const item of payload) {
           await OfflineQueue.enqueue(table, 'UPSERT', item, priority);
        }
        return payload;
      }
      return await OfflineQueue.enqueue(table, 'UPSERT', payload, priority);
    }
    const { data, error } = await supabase.from(table).upsert(payload).select();
    if (error) throw error;
    return data;
  }
}
