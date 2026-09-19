import { offlineDb, LocalConversation, LocalChatMessage, MessageSyncState, PendingMessage } from './offlineDb';
import { Conversation, ChatMessage } from '../types';

export class ChatLocalStore {
  /**
   * Reads cached conversations from IndexedDB immediately (0ms latency)
   */
  static async getCachedConversations(institutionId: string): Promise<Conversation[]> {
    try {
      if (!institutionId) return [];
      const rows = await offlineDb.local_conversations
        .where('institution_id')
        .equals(institutionId)
        .reverse()
        .sortBy('updated_at');

      return rows.map(r => ({
        id: r.id,
        institution_id: r.institution_id,
        type: r.type,
        name: r.name,
        class_id: r.class_id,
        is_announcement_only: r.is_announcement_only,
        avatar_url: r.avatar_url,
        created_at: r.created_at,
        updated_at: r.updated_at,
        unread_count: r.unread_count || 0,
        last_message: r.last_message,
        is_pinned: r.pinned,
        is_muted: r.muted
      }));
    } catch (err) {
      console.warn('[ChatLocalStore] Failed to read cached conversations:', err);
      return [];
    }
  }

  /**
   * Persists or updates conversations in IndexedDB
   */
  static async saveConversations(conversations: Conversation[], institutionId: string): Promise<void> {
    try {
      if (!conversations || conversations.length === 0) return;
      const rows: LocalConversation[] = conversations.map(c => ({
        id: c.id,
        institution_id: c.institution_id || institutionId,
        type: c.type,
        name: c.name || '',
        class_id: c.class_id,
        is_announcement_only: c.is_announcement_only,
        avatar_url: (c as any).avatar_url,
        created_at: c.created_at || new Date().toISOString(),
        updated_at: c.updated_at || new Date().toISOString(),
        unread_count: c.unread_count || 0,
        last_message: c.last_message,
        pinned: (c as any).is_pinned,
        muted: (c as any).is_muted
      }));

      await offlineDb.local_conversations.bulkPut(rows);
    } catch (err) {
      console.warn('[ChatLocalStore] Failed to save conversations:', err);
    }
  }

  /**
   * Reads cached messages for a conversation ordered chronologically (created_at ascending)
   */
  static async getCachedMessages(conversationId: string, limit = 100): Promise<ChatMessage[]> {
    try {
      if (!conversationId) return [];

      // Query by conversation_id ordered by created_at ascending
      const rows = await offlineDb.local_messages
        .where('conversation_id')
        .equals(conversationId)
        .sortBy('created_at');

      const sliced = rows.slice(-limit);

      return sliced.map(r => this.localRowToChatMessage(r));
    } catch (err) {
      console.warn('[ChatLocalStore] Failed to read cached messages:', err);
      return [];
    }
  }

  /**
   * Reads older cached messages before a specific timestamp for pagination
   */
  static async getCachedOlderMessages(
    conversationId: string,
    beforeCreatedAt: string,
    limit = 50
  ): Promise<ChatMessage[]> {
    try {
      if (!conversationId || !beforeCreatedAt) return [];

      const rows = await offlineDb.local_messages
        .where('conversation_id')
        .equals(conversationId)
        .filter(m => m.created_at < beforeCreatedAt)
        .sortBy('created_at');

      const sliced = rows.slice(-limit);
      return sliced.map(r => this.localRowToChatMessage(r));
    } catch (err) {
      console.warn('[ChatLocalStore] Failed to read older cached messages:', err);
      return [];
    }
  }

  /**
   * Saves or merges a single message into IndexedDB with duplicate prevention.
   * Handles idempotency key (client_message_id) vs server ID transitions.
   */
  static async saveMessage(msg: ChatMessage | LocalChatMessage): Promise<void> {
    try {
      if (!msg.conversation_id) return;

      const clientMsgId = msg.client_message_id || msg.id;
      const targetId = msg.id || clientMsgId;

      // Check if an existing record has this client_message_id
      const existingByClientId = await offlineDb.local_messages
        .where('client_message_id')
        .equals(clientMsgId)
        .first();

      // If existing record was stored under client_message_id and we now have a distinct server ID,
      // delete the temporary client_message_id primary key entry to avoid duplication.
      if (existingByClientId && existingByClientId.id !== targetId && existingByClientId.id === clientMsgId) {
        await offlineDb.local_messages.delete(existingByClientId.id);
      }

      const rowToSave: LocalChatMessage = {
        id: targetId,
        client_message_id: clientMsgId,
        conversation_id: msg.conversation_id,
        institution_id: msg.institution_id || '',
        sender_id: msg.sender_id || '',
        sender_name: msg.sender_name,
        class_name: msg.class_name,
        message: msg.message || '',
        message_type: msg.message_type || 'text',
        attachment_url: msg.attachment_url,
        attachment_name: msg.attachment_name,
        attachment_size: msg.attachment_size,
        voice_duration: msg.voice_duration,
        reply_to_message_id: msg.reply_to_message_id,
        reply_to_message: msg.reply_to_message,
        is_edited: msg.is_edited || false,
        edited_at: msg.edited_at,
        is_deleted: msg.is_deleted || false,
        deleted_for_me: msg.deleted_for_me || false,
        is_starred: msg.is_starred || false,
        is_parent: msg.is_parent,
        sender_role: msg.sender_role,
        delivered_at: msg.delivered_at,
        read_at: msg.read_at,
        read_by: msg.read_by,
        delivered_to: msg.delivered_to,
        created_at: msg.created_at || new Date().toISOString(),
        updated_at: msg.updated_at || new Date().toISOString(),
        sender_profile: msg.sender_profile,
        status: (msg as any).status || (msg as any).synced === 1 ? 'sent' : 'pending',
        synced: (msg as any).synced ?? 1,
        error: (msg as any).error
      };

      await offlineDb.local_messages.put(rowToSave);

      // Also update last_message on conversation in local_conversations
      const conv = await offlineDb.local_conversations.get(msg.conversation_id);
      if (conv) {
        await offlineDb.local_conversations.update(msg.conversation_id, {
          last_message: this.localRowToChatMessage(rowToSave),
          updated_at: rowToSave.created_at
        });
      }
    } catch (err) {
      console.warn('[ChatLocalStore] Failed to save message:', err);
    }
  }

  /**
   * Bulk merges server messages into IndexedDB, preserving any local pending edits
   */
  static async saveMessages(
    messages: ChatMessage[],
    conversationId: string,
    institutionId: string
  ): Promise<void> {
    try {
      if (!messages || messages.length === 0) return;

      for (const msg of messages) {
        await this.saveMessage({
          ...msg,
          conversation_id: conversationId,
          institution_id: institutionId,
          status: msg.status || (msg.read_at ? 'read' : msg.delivered_at ? 'delivered' : 'sent'),
          synced: 1
        });
      }

      // Update sync state timestamp
      const latestMsg = messages[messages.length - 1];
      const oldestMsg = messages[0];
      if (latestMsg) {
        await this.updateSyncState({
          conversation_id: conversationId,
          institution_id: institutionId,
          last_synced_at: latestMsg.created_at,
          oldest_message_created_at: oldestMsg?.created_at
        });
      }
    } catch (err) {
      console.warn('[ChatLocalStore] Failed to bulk save messages:', err);
    }
  }

  /**
   * Enqueues an offline or sending message into pending_messages
   */
  static async enqueuePendingMessage(pendingMsg: PendingMessage): Promise<void> {
    try {
      await offlineDb.pending_messages.put(pendingMsg);
    } catch (err) {
      console.warn('[ChatLocalStore] Failed to enqueue pending message:', err);
    }
  }

  /**
   * Retrieves all unsynced pending messages for an institution
   */
  static async getPendingMessages(institutionId?: string): Promise<PendingMessage[]> {
    try {
      let query = offlineDb.pending_messages.toCollection();
      if (institutionId) {
        query = offlineDb.pending_messages.where('institution_id').equals(institutionId);
      }
      return await query.sortBy('created_at');
    } catch (err) {
      console.warn('[ChatLocalStore] Failed to get pending messages:', err);
      return [];
    }
  }

  /**
   * Removes a successfully synced message from pending_messages and updates local_messages
   */
  static async markMessageSynced(clientMessageId: string, serverId: string): Promise<void> {
    try {
      // 1. Remove from pending_messages
      await offlineDb.pending_messages.delete(clientMessageId);

      // 2. Find local message and update to synced = 1, status = 'sent', and server id
      const existing = await offlineDb.local_messages
        .where('client_message_id')
        .equals(clientMessageId)
        .first();

      if (existing) {
        if (existing.id !== serverId && existing.id === clientMessageId) {
          await offlineDb.local_messages.delete(existing.id);
        }
        await offlineDb.local_messages.put({
          ...existing,
          id: serverId,
          status: 'sent',
          synced: 1,
          error: undefined
        });
      }
    } catch (err) {
      console.warn('[ChatLocalStore] Failed to mark message as synced:', err);
    }
  }

  /**
   * Marks a pending message as failed with an error message
   */
  static async markMessageFailed(clientMessageId: string, error: string): Promise<void> {
    try {
      // Update pending queue
      const pending = await offlineDb.pending_messages.get(clientMessageId);
      if (pending) {
        await offlineDb.pending_messages.update(clientMessageId, {
          status: 'failed',
          error,
          last_attempt: Date.now(),
          retry_count: (pending.retry_count || 0) + 1
        });
      }

      // Update local message
      const local = await offlineDb.local_messages
        .where('client_message_id')
        .equals(clientMessageId)
        .first();

      if (local) {
        await offlineDb.local_messages.update(local.id, {
          status: 'failed',
          error
        });
      }
    } catch (err) {
      console.warn('[ChatLocalStore] Failed to mark message as failed:', err);
    }
  }

  /**
   * Updates message status (e.g. sending, delivered, read)
   */
  static async updateMessageStatus(
    clientMessageIdOrId: string,
    status: ChatMessage['status']
  ): Promise<void> {
    try {
      const local = await offlineDb.local_messages
        .where('client_message_id')
        .equals(clientMessageIdOrId)
        .first() || await offlineDb.local_messages.get(clientMessageIdOrId);

      if (local) {
        await offlineDb.local_messages.update(local.id, { status });
      }
    } catch (err) {
      console.warn('[ChatLocalStore] Failed to update message status:', err);
    }
  }

  /**
   * Get sync state metadata for a conversation
   */
  static async getSyncState(conversationId: string): Promise<MessageSyncState | undefined> {
    try {
      return await offlineDb.message_sync_state.get(conversationId);
    } catch {
      return undefined;
    }
  }

  /**
   * Updates sync state for a conversation
   */
  static async updateSyncState(
    state: Partial<MessageSyncState> & { conversation_id: string; institution_id: string }
  ): Promise<void> {
    try {
      const existing = await offlineDb.message_sync_state.get(state.conversation_id);
      const updated: MessageSyncState = {
        conversation_id: state.conversation_id,
        institution_id: state.institution_id,
        last_synced_at: state.last_synced_at || existing?.last_synced_at,
        last_read_message_id: state.last_read_message_id || existing?.last_read_message_id,
        last_read_at: state.last_read_at || existing?.last_read_at,
        oldest_message_created_at: state.oldest_message_created_at || existing?.oldest_message_created_at,
        has_more_history: state.has_more_history ?? existing?.has_more_history
      };
      await offlineDb.message_sync_state.put(updated);
    } catch (err) {
      console.warn('[ChatLocalStore] Failed to update sync state:', err);
    }
  }

  /**
   * Updates last read timestamp and reconciles unread count locally
   */
  static async updateLastRead(
    conversationId: string,
    institutionId: string,
    userId: string,
    lastMessageId?: string
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      await this.updateSyncState({
        conversation_id: conversationId,
        institution_id: institutionId,
        last_read_at: now,
        last_read_message_id: lastMessageId
      });

      // Reset unread_count on local conversation
      const conv = await offlineDb.local_conversations.get(conversationId);
      if (conv) {
        await offlineDb.local_conversations.update(conversationId, { unread_count: 0 });
      }
    } catch (err) {
      console.warn('[ChatLocalStore] Failed to update last read:', err);
    }
  }

  /**
   * Calculates unread count from local messages
   */
  static async getUnreadCount(
    conversationId: string,
    lastReadAt: string,
    currentUserId: string
  ): Promise<number> {
    try {
      if (!conversationId) return 0;
      const count = await offlineDb.local_messages
        .where('conversation_id')
        .equals(conversationId)
        .filter(m => m.created_at > lastReadAt && m.sender_id !== currentUserId)
        .count();
      return count;
    } catch {
      return 0;
    }
  }

  /**
   * LRU Local Cache Pruning Policy:
   * Removes oldest safely synced messages per conversation when cache exceeds limit.
   * NEVER deletes pending/unsynced messages (synced === 0).
   */
  static async pruneOldCache(maxKeepPerConversation = 200): Promise<void> {
    try {
      const conversations = await offlineDb.local_conversations.toArray();
      for (const conv of conversations) {
        const syncedCount = await offlineDb.local_messages
          .where('conversation_id')
          .equals(conv.id)
          .filter(m => m.synced === 1)
          .count();

        if (syncedCount > maxKeepPerConversation) {
          const excess = syncedCount - maxKeepPerConversation;
          const oldestSynced = await offlineDb.local_messages
            .where('conversation_id')
            .equals(conv.id)
            .filter(m => m.synced === 1)
            .sortBy('created_at');

          const idsToDelete = oldestSynced.slice(0, excess).map(m => m.id);
          await offlineDb.local_messages.bulkDelete(idsToDelete);
          console.log(`[ChatLocalStore] Pruned ${idsToDelete.length} synced messages from ${conv.id}`);
        }
      }
    } catch (err) {
      console.warn('[ChatLocalStore] Prune old cache notice:', err);
    }
  }

  /**
   * Helper to convert LocalChatMessage to ChatMessage
   */
  private static localRowToChatMessage(row: LocalChatMessage): ChatMessage {
    return {
      id: row.id,
      conversation_id: row.conversation_id,
      institution_id: row.institution_id,
      sender_id: row.sender_id,
      sender_name: row.sender_name,
      class_name: row.class_name,
      client_message_id: row.client_message_id,
      message: row.message,
      message_type: row.message_type,
      attachment_url: row.attachment_url,
      attachment_name: row.attachment_name,
      attachment_size: row.attachment_size,
      voice_duration: row.voice_duration,
      reply_to_message_id: row.reply_to_message_id,
      reply_to_message: row.reply_to_message,
      is_edited: row.is_edited,
      edited_at: row.edited_at,
      is_deleted: row.is_deleted,
      deleted_for_me: row.deleted_for_me,
      is_starred: row.is_starred,
      is_parent: row.is_parent,
      sender_role: row.sender_role,
      delivered_at: row.delivered_at,
      read_at: row.read_at,
      read_by: row.read_by,
      delivered_to: row.delivered_to,
      created_at: row.created_at,
      updated_at: row.updated_at,
      sender_profile: row.sender_profile,
      status: row.status,
      synced: row.synced,
      error: row.error
    };
  }
}
