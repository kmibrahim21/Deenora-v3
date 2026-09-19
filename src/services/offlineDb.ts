import Dexie, { type Table } from 'dexie';
import { ConversationType } from '../types';

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

export interface LocalConversation {
  id: string;
  institution_id: string;
  type: ConversationType;
  name: string;
  class_id?: string;
  is_announcement_only?: boolean;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  unread_count?: number;
  last_message?: any;
  pinned?: boolean;
  muted?: boolean;
}

export interface LocalChatMessage {
  id: string;
  client_message_id: string;
  conversation_id: string;
  institution_id: string;
  sender_id: string;
  sender_name?: string;
  class_name?: string;
  message: string;
  message_type: 'text' | 'image' | 'document' | 'voice' | 'system_event';
  attachment_url?: string;
  attachment_name?: string;
  attachment_size?: number;
  voice_duration?: number;
  reply_to_message_id?: string;
  reply_to_message?: any;
  is_edited?: boolean;
  edited_at?: string;
  is_deleted?: boolean;
  deleted_for_me?: boolean;
  is_starred?: boolean;
  is_parent?: boolean;
  sender_role?: string;
  delivered_at?: string;
  read_at?: string;
  read_by?: any[];
  delivered_to?: any[];
  created_at: string;
  updated_at?: string;
  sender_profile?: any;
  status: 'pending' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  synced: 0 | 1;
  error?: string;
}

export interface MessageSyncState {
  conversation_id: string;
  institution_id: string;
  last_synced_at?: string;
  last_read_message_id?: string;
  last_read_at?: string;
  oldest_message_created_at?: string;
  has_more_history?: boolean;
}

export interface PendingMessage {
  client_message_id: string;
  conversation_id: string;
  institution_id: string;
  sender_id: string;
  sender_name?: string;
  class_name?: string;
  message: string;
  message_type: 'text' | 'image' | 'document' | 'voice' | 'system_event';
  attachment_url?: string;
  attachment_name?: string;
  attachment_size?: number;
  voice_duration?: number;
  reply_to_message_id?: string;
  reply_to_message?: any;
  created_at: string;
  status: 'pending' | 'sending' | 'failed';
  retry_count: number;
  last_attempt?: number;
  error?: string;
}

export interface LocalArchiveRecord {
  id: string; // archive_id
  institution_id: string;
  conversation_id?: string;
  conversation_name?: string;
  date_start: string;
  date_end: string;
  message_count: number;
  archive_size_bytes: number;
  compressed_size_bytes?: number;
  checksum: string;
  encryption_version: string;
  storage_location: string;
  storage_path?: string;
  status: 'created' | 'verified' | 'cleaned_up' | 'failed';
  crypto_metadata?: any;
  created_at: string;
  verified_at?: string;
  cleaned_up_at?: string;
}

export interface ArchivedMessageCache {
  id: string;
  client_message_id?: string;
  conversation_id: string;
  institution_id: string;
  archive_id: string;
  sender_id: string;
  sender_name?: string;
  message: string;
  message_type: 'text' | 'image' | 'document' | 'voice' | 'system_event';
  attachment_url?: string;
  attachment_name?: string;
  voice_duration?: number;
  reply_to_message_id?: string;
  created_at: string;
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
  local_conversations!: Table<LocalConversation, string>;
  local_messages!: Table<LocalChatMessage, string>;
  message_sync_state!: Table<MessageSyncState, string>;
  pending_messages!: Table<PendingMessage, string>;
  local_archives!: Table<LocalArchiveRecord, string>;
  archived_messages_cache!: Table<ArchivedMessageCache, string>;

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

    this.version(7).stores({
      local_conversations: 'id, institution_id, type, class_id, updated_at',
      local_messages: 'id, client_message_id, conversation_id, institution_id, created_at, status, synced, [conversation_id+created_at]',
      message_sync_state: 'conversation_id, institution_id',
      pending_messages: 'client_message_id, conversation_id, institution_id, created_at, status, retry_count'
    });

    this.version(8).stores({
      local_conversations: 'id, institution_id, type, class_id, updated_at',
      local_messages: 'id, client_message_id, conversation_id, institution_id, created_at, status, synced, [conversation_id+created_at]',
      message_sync_state: 'conversation_id, institution_id',
      pending_messages: 'client_message_id, conversation_id, institution_id, created_at, status, retry_count',
      local_archives: 'id, institution_id, conversation_id, status, created_at, [institution_id+status]',
      archived_messages_cache: 'id, client_message_id, conversation_id, institution_id, archive_id, created_at, [conversation_id+created_at]'
    });
  }
}

export const offlineDb = new OfflineDatabase();
